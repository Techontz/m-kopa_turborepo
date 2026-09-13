<?php

namespace App\Services;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Enums\PaymentStatus;
use App\Integrations\Payments\PaymentNotification;
use App\Integrations\Sms\SmsGateway;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanTransaction;
use App\Models\Payment;
use App\Models\PaymentAllocation;
use App\Models\SmsLog;
use App\Models\TellerDeposit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Repayment channels (Documents: 💰 REPAYMENT OVERVIEW):
 *  1. Direct payment (webhook) → match loan → auto allocate → SMS; no match → Suspense.
 *  2. Unmatched payment → Suspense → Finance allocates to a loan.
 *  3. Cash → Teller (PENDING_VERIFICATION) → bank deposit slip → Finance verify → confirm → allocate → SMS.
 *
 * Loan allocation always goes through LoanService::allocate()/deposit() (Principal → Penalty → Interest → Insurance).
 *
 * Ledger (every step is balanced and immutable):
 *  - teller cash received:      Dr Teller Cash (branch, teller)  Cr Suspense (branch)
 *  - cash confirmed:            Dr Bank (slip bank A/C)          Cr Teller Cash
 *  - unmatched / excess money:  Dr Bank                          Cr Suspense
 *  - any allocation to a loan:  Dr Suspense                      Cr Bank, then LoanService::deposit()
 *    (Dr Principal/Penarty/Interest/Insurance A/C, Cr Loan Receivable / income) — so held money moves
 *    into the branch fund accounts exactly like a live teller deposit.
 *  - rejected teller cash:      Ledger::reverse() of the receipt entry.
 * Inferred: the bank leg is posted against the bank account on the slip (or the company-level bank
 * clearing account for provider receipts) and cleared on allocation, because this ledger holds branch
 * money in the fund accounts that LoanService::deposit() debits.
 */
class PaymentService
{
    public function __construct(
        private readonly Ledger $ledger,
        private readonly LoanService $loans,
    ) {}

    /**
     * Loan currently accepting repayments for a customer.
     */
    public function repayableLoan(Customer $customer): ?Loan
    {
        return $customer->loans()->whereIn('status', LoanStatus::values(...LoanStatus::repayable()))->latest('id')->first();
    }

    /**
     * Teller cash recorded but not yet confirmed for a loan.
     */
    public function pendingCash(Loan $loan): float
    {
        return round((float) Payment::where('loan_id', $loan->id)
            ->whereIn('status', [PaymentStatus::PendingVerification->value, PaymentStatus::Deposited->value])
            ->sum('amount'), 2);
    }

    /**
     * Teller receives cash from a customer (POST /payments/cash). Held as PENDING_VERIFICATION.
     */
    public function recordCash(Loan $loan, float $amount, string $method, Employee $teller, ?CarbonImmutable $date = null): Payment
    {
        $date ??= CarbonImmutable::today();

        if (! in_array($loan->status, LoanStatus::repayable(), true)) {
            throw ValidationException::withMessages(['depost' => 'This loan is not active.']);
        }

        $available = round($this->loans->outstanding($loan)['total'] - $this->pendingCash($loan), 2);
        if ($amount > $available + 0.001) {
            throw ValidationException::withMessages(['depost' => 'Amount exceeds the outstanding balance of '.money(max(0, $available)).'.']);
        }

        return DB::transaction(function () use ($loan, $amount, $method, $teller, $date): Payment {
            $payment = Payment::create([
                'company_id' => $loan->company_id,
                'branch_id' => $loan->branch_id,
                'customer_id' => $loan->customer_id,
                'loan_id' => $loan->id,
                'employee_id' => $teller->id,
                'source' => Payment::SOURCE_TELLER,
                'channel' => strtoupper($method),
                'reference' => $loan->reference_number ?? $loan->loan_number,
                'phone' => $loan->customer->phone,
                'amount' => $amount,
                'status' => PaymentStatus::PendingVerification,
                'paid_on' => $date->toDateString(),
            ]);

            $entry = $this->ledger->journal($loan->company_id, 'TELLER CASH '.$loan->loan_number, [
                ['account' => Account::TellerCash, 'branch' => $loan->branch_id, 'employee' => $teller->id, 'debit' => $amount],
                ['account' => Account::Suspense, 'branch' => $loan->branch_id, 'credit' => $amount],
            ], $payment, $date, $loan->branch_id, $teller);

            $payment->forceFill(['journal_entry_id' => $entry->id, 'receipt_number' => $this->receiptNumber($payment)])->save();

            return $payment;
        });
    }

    /**
     * Teller banks the cash: a deposit slip covering one or more pending receipts of the teller's branch.
     *
     * @param  array{bank_account_id: int, slip_number: string, amount: float, deposit_date: string}  $data
     * @param  list<int>  $paymentIds
     */
    public function submitBankDeposit(Employee $teller, int $branchId, array $data, array $paymentIds): TellerDeposit
    {
        return DB::transaction(function () use ($teller, $branchId, $data, $paymentIds): TellerDeposit {
            $payments = Payment::whereKey($paymentIds)
                ->where('company_id', $teller->company_id)
                ->where('branch_id', $branchId)
                ->where('source', Payment::SOURCE_TELLER)
                ->where('status', PaymentStatus::PendingVerification->value)
                ->lockForUpdate()
                ->get();

            if ($payments->count() !== count(array_unique($paymentIds))) {
                throw ValidationException::withMessages(['payment_ids' => 'Some receipts are not pending verification in this branch.']);
            }

            $deposit = TellerDeposit::create([
                'company_id' => $teller->company_id,
                'branch_id' => $branchId,
                'employee_id' => $teller->id,
                'bank_account_id' => $data['bank_account_id'],
                'slip_number' => $data['slip_number'],
                'amount' => $data['amount'],
                'deposit_date' => $data['deposit_date'],
                'status' => TellerDeposit::STATUS_PENDING,
            ]);

            foreach ($payments as $payment) {
                $payment->update(['teller_deposit_id' => $deposit->id, 'bank_account_id' => $deposit->bank_account_id, 'status' => PaymentStatus::Deposited]);
            }

            return $deposit;
        });
    }

    /**
     * Finance matches a slip with the bank statement (POST /finance/bank-reconciliation).
     * IF deposit matches → verified, ELSE → keep pending (status "mismatch" for investigation).
     */
    public function verifyDeposit(TellerDeposit $deposit, float $statementAmount, string $statementReference, Employee $finance): TellerDeposit
    {
        if (! in_array($deposit->status, [TellerDeposit::STATUS_PENDING, TellerDeposit::STATUS_MISMATCH], true)) {
            throw ValidationException::withMessages(['statement_amount' => 'This deposit has already been processed.']);
        }

        $matches = abs($statementAmount - (float) $deposit->amount) < 0.01 && abs((float) $deposit->amount - $deposit->expectedAmount()) < 0.01;

        $deposit->update([
            'statement_amount' => $statementAmount,
            'statement_reference' => $statementReference,
            'status' => $matches ? TellerDeposit::STATUS_VERIFIED : TellerDeposit::STATUS_MISMATCH,
            'verified_by' => $finance->id,
            'verified_at' => now(),
        ]);

        return $deposit;
    }

    /**
     * Final confirmation (POST /payments/confirm): Dr Bank Cr Teller Cash, allocate each receipt to its loan, SMS.
     */
    public function confirmDeposit(TellerDeposit $deposit, Employee $finance): TellerDeposit
    {
        if ($deposit->status !== TellerDeposit::STATUS_VERIFIED) {
            throw ValidationException::withMessages(['deposit' => 'Only verified deposits can be confirmed.']);
        }

        return DB::transaction(function () use ($deposit, $finance): TellerDeposit {
            $date = CarbonImmutable::today();
            $payments = $deposit->payments()->with(['loan', 'customer'])->lockForUpdate()->get();

            foreach ($payments->groupBy('employee_id') as $tellerId => $tellerPayments) {
                $total = round((float) $tellerPayments->sum('amount'), 2);
                $this->ledger->journal($deposit->company_id, 'TELLER CASH BANKED '.$deposit->slip_number, [
                    ['account' => Account::Bank, 'bank' => $deposit->bank_account_id, 'debit' => $total],
                    ['account' => Account::TellerCash, 'branch' => $deposit->branch_id, 'employee' => $tellerId ?: null, 'credit' => $total],
                ], $deposit, $date, $deposit->branch_id, $finance);
            }

            foreach ($payments as $payment) {
                $payment->update(['status' => PaymentStatus::Confirmed, 'verified_by' => $finance->id, 'verified_at' => now()]);
                $excess = $this->applyToLoan($payment, $payment->loan, (float) $payment->amount, $date, $finance);
                if ($excess > 0) {
                    $this->holdExcess($payment, $excess, $date, alreadyInSuspense: true);
                }
                $this->notify($payment->customer, 'Malipo yako ya cash ya TSH '.money($payment->amount - $excess).' yamethibitishwa. Risiti: '.$payment->receipt_number);
            }

            $deposit->update(['status' => TellerDeposit::STATUS_CONFIRMED, 'confirmed_by' => $finance->id, 'confirmed_at' => now()]);

            return $deposit;
        });
    }

    /**
     * Finance rejects a slip (teller has not deposited / amount mismatch): receipts return to pending.
     */
    public function rejectDeposit(TellerDeposit $deposit, string $reason, Employee $finance): TellerDeposit
    {
        if (in_array($deposit->status, [TellerDeposit::STATUS_CONFIRMED, TellerDeposit::STATUS_REJECTED], true)) {
            throw ValidationException::withMessages(['reason' => 'This deposit has already been processed.']);
        }

        return DB::transaction(function () use ($deposit, $reason, $finance): TellerDeposit {
            foreach ($deposit->payments as $payment) {
                $payment->update(['teller_deposit_id' => null, 'bank_account_id' => null, 'status' => PaymentStatus::PendingVerification]);
            }
            $deposit->update(['status' => TellerDeposit::STATUS_REJECTED, 'rejection_reason' => $reason, 'verified_by' => $finance->id, 'verified_at' => now()]);

            return $deposit;
        });
    }

    /**
     * Finance rejects a teller cash receipt (e.g. wrong entry): the receipt entry is reversed.
     */
    public function rejectCash(Payment $payment, string $reason, Employee $finance): Payment
    {
        if ($payment->source !== Payment::SOURCE_TELLER || $payment->status !== PaymentStatus::PendingVerification) {
            throw ValidationException::withMessages(['reason' => 'Only cash pending verification can be rejected.']);
        }

        return DB::transaction(function () use ($payment, $reason, $finance): Payment {
            if ($payment->journalEntry !== null) {
                $this->ledger->reverse($payment->journalEntry, 'CASH REJECTED: '.$reason);
            }
            $payment->update(['status' => PaymentStatus::Rejected, 'rejection_reason' => $reason, 'verified_by' => $finance->id, 'verified_at' => now()]);

            return $payment;
        });
    }

    /**
     * Direct payment webhook. Idempotent by channel + transaction_id.
     *
     * @return array{status: string, payment: Payment}
     */
    public function receive(PaymentNotification $notification): array
    {
        $existing = Payment::where('channel', $notification->channel)->where('transaction_id', $notification->transactionId)->first();
        if ($existing !== null) {
            return $this->duplicate($existing, $notification);
        }

        $loan = $this->matchLoan($notification);
        $companyId = $loan?->company_id ?? $this->defaultCompanyId();
        if ($companyId === null) {
            throw ValidationException::withMessages(['reference' => 'Payment could not be matched to a company.']);
        }

        try {
            return DB::transaction(function () use ($notification, $loan, $companyId): array {
                $date = $notification->paidOn ? CarbonImmutable::parse($notification->paidOn)->startOfDay() : CarbonImmutable::today();
                $payment = Payment::create([
                    'company_id' => $companyId,
                    'branch_id' => $loan?->branch_id,
                    'customer_id' => $loan?->customer_id,
                    'loan_id' => $loan?->id,
                    'source' => Payment::SOURCE_WEBHOOK,
                    'channel' => $notification->channel,
                    'reference' => $notification->reference,
                    'transaction_id' => $notification->transactionId,
                    'phone' => $notification->phone,
                    'amount' => $notification->amount,
                    'status' => $loan ? PaymentStatus::Allocated : PaymentStatus::Unallocated,
                    'paid_on' => $date->toDateString(),
                    'note' => $loan ? null : 'Invalid or missing reference',
                    'payload' => $notification->payload,
                ]);
                $payment->forceFill(['receipt_number' => $this->receiptNumber($payment)])->save();

                if ($loan === null) {
                    $this->receiveIntoSuspense($payment, $notification->amount, $date);

                    return ['status' => 'SUSPENSE', 'payment' => $payment];
                }

                $excess = $this->applyToLoan($payment, $loan, $notification->amount, $date, null, fromSuspense: false);
                if ($excess > 0) {
                    $this->holdExcess($payment, $excess, $date, alreadyInSuspense: false);
                }
                $this->notify($loan->customer, 'Tumepokea malipo yako ya TSH '.money($notification->amount).'. Kumbukumbu: '.$notification->transactionId);

                return ['status' => 'PAYMENT_SUCCESS', 'payment' => $payment];
            });
        } catch (QueryException $exception) {
            $existing = Payment::where('channel', $notification->channel)->where('transaction_id', $notification->transactionId)->first();
            if ($existing !== null) {
                return $this->duplicate($existing, $notification);
            }
            throw $exception;
        }
    }

    /**
     * Finance records an unmatched payment found on a bank/mobile statement (POST /payments/unmatched).
     *
     * @param  array{amount: float, channel: string, reference?: string|null, transaction_id?: string|null, phone?: string|null, paid_on: string, branch_id?: int|null, note?: string|null}  $data
     */
    public function recordUnmatched(Company|int $company, array $data, Employee $finance): Payment
    {
        return DB::transaction(function () use ($company, $data, $finance): Payment {
            $date = CarbonImmutable::parse($data['paid_on']);
            $payment = Payment::create([
                'company_id' => $company instanceof Company ? $company->id : $company,
                'branch_id' => $data['branch_id'] ?? null,
                'employee_id' => $finance->id,
                'source' => Payment::SOURCE_MANUAL,
                'channel' => strtoupper($data['channel']),
                'reference' => $data['reference'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? null,
                'phone' => $data['phone'] ?? null,
                'amount' => $data['amount'],
                'status' => PaymentStatus::Unallocated,
                'paid_on' => $date->toDateString(),
                'note' => $data['note'] ?? null,
            ]);
            $payment->forceFill(['receipt_number' => $this->receiptNumber($payment)])->save();
            $this->receiveIntoSuspense($payment, (float) $data['amount'], $date, $finance);

            return $payment;
        });
    }

    /**
     * Finance allocates suspense money to a loan (POST /payments/allocate). Money beyond the loan's
     * outstanding balance stays in suspense on the same record.
     */
    public function allocateSuspense(Payment $payment, Loan $loan, float $amount, Employee $finance): Payment
    {
        if ($payment->status !== PaymentStatus::Unallocated) {
            throw ValidationException::withMessages(['loan_id' => 'Only unallocated suspense payments can be allocated.']);
        }
        if (! in_array($loan->status, LoanStatus::repayable(), true)) {
            throw ValidationException::withMessages(['loan_id' => 'This loan is not active.']);
        }
        if ($amount > $payment->unallocated_amount + 0.001) {
            throw ValidationException::withMessages(['amount' => 'Amount exceeds the unallocated balance of '.money($payment->unallocated_amount).'.']);
        }
        $outstanding = $this->loans->outstanding($loan)['total'];
        if ($amount > $outstanding + 0.001) {
            throw ValidationException::withMessages(['amount' => 'Amount exceeds the outstanding balance of '.money($outstanding).'.']);
        }

        return DB::transaction(function () use ($payment, $loan, $amount, $finance): Payment {
            $this->applyToLoan($payment, $loan, $amount, CarbonImmutable::today(), $finance);
            $payment->refresh();
            $payment->update([
                'customer_id' => $payment->customer_id ?? $loan->customer_id,
                'status' => $payment->unallocated_amount <= 0.001 ? PaymentStatus::Allocated : PaymentStatus::Unallocated,
                'verified_by' => $finance->id,
                'verified_at' => now(),
            ]);
            $this->notify($loan->customer, 'Tumepokea malipo yako ya TSH '.money($amount).'. Risiti: '.$payment->receipt_number);

            return $payment;
        });
    }

    /**
     * Flag suspense money (fraud suspicion / wrong customer) — it stays in suspense.
     */
    public function flag(Payment $payment, string $reason): Payment
    {
        if (! in_array($payment->status, PaymentStatus::suspense(), true)) {
            throw ValidationException::withMessages(['reason' => 'Only suspense payments can be flagged.']);
        }

        $payment->update(['status' => $payment->status === PaymentStatus::Flagged ? PaymentStatus::Unallocated : PaymentStatus::Flagged, 'flag_reason' => $reason]);

        return $payment;
    }

    /**
     * Return unallocated suspense money to the payer (Documents: overpayment → refund): Dr Suspense Cr Bank.
     */
    public function refund(Payment $payment, string $reason, Employee $finance): Payment
    {
        if (! in_array($payment->status, PaymentStatus::suspense(), true) || $payment->unallocated_amount <= 0) {
            throw ValidationException::withMessages(['reason' => 'Only unallocated suspense money can be refunded.']);
        }

        return DB::transaction(function () use ($payment, $reason, $finance): Payment {
            $amount = $payment->unallocated_amount;
            $this->ledger->journal($payment->company_id, 'SUSPENSE REFUND '.$payment->receipt_number, [
                ['account' => Account::Suspense, 'branch' => $payment->branch_id, 'debit' => $amount],
                ['account' => Account::Bank, 'bank' => $payment->bank_account_id, 'credit' => $amount],
            ], $payment, CarbonImmutable::today(), $payment->branch_id, $finance);

            $payment->update(['status' => PaymentStatus::Refunded, 'rejection_reason' => $reason, 'verified_by' => $finance->id, 'verified_at' => now()]);

            return $payment;
        });
    }

    /**
     * Customer statement: every loan transaction with its Principal / Penalty / Interest / Insurance split.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function statement(Customer $customer, ?string $from = null, ?string $to = null): Collection
    {
        $balances = [];
        $transactions = LoanTransaction::query()
            ->where('customer_id', $customer->id)
            ->with(['loan:id,loan_number,reference_number,total_payable,insurance', 'employee:id,first_name,last_name'])
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();
        $receipts = PaymentAllocation::whereIn('loan_transaction_id', $transactions->modelKeys())
            ->with('payment:id,receipt_number,channel,transaction_id')
            ->get()
            ->keyBy('loan_transaction_id');

        return $transactions
            ->map(function (LoanTransaction $transaction) use (&$balances, $receipts): array {
                $loan = $transaction->loan;
                $key = $transaction->loan_id ?? 0;
                $balances[$key] ??= $loan ? (float) $loan->total_payable + (float) $loan->insurance : 0.0;
                $isDeposit = $transaction->type === 'deposit';
                if ($isDeposit) {
                    $balances[$key] = max(0.0, $balances[$key] - (float) $transaction->amount);
                }
                $receipt = $receipts->get($transaction->id)?->payment;

                return [
                    'id' => $transaction->id,
                    'date' => $transaction->transaction_date->toDateString(),
                    'loan_id' => $transaction->loan_id,
                    'loan_number' => $loan?->loan_number,
                    'reference_number' => $loan?->reference_number,
                    'type' => $transaction->type,
                    'description' => $transaction->description,
                    'method' => $transaction->method,
                    'receipt_number' => $receipt?->receipt_number,
                    'transaction_id' => $receipt?->transaction_id,
                    'deposit' => $isDeposit ? (float) $transaction->amount : 0.0,
                    'withdrawal' => $isDeposit ? 0.0 : (float) $transaction->amount,
                    'principal' => (float) $transaction->principal,
                    'penalty' => (float) $transaction->penalty,
                    'interest' => (float) $transaction->interest,
                    'insurance' => (float) $transaction->insurance,
                    'reserve' => (float) $transaction->reserve,
                    'remain_debit' => round($balances[$key], 2),
                    'employee' => $transaction->employee ? trim($transaction->employee->first_name.' '.$transaction->employee->last_name) : null,
                ];
            })
            ->filter(fn (array $row): bool => ($from === null || $row['date'] >= $from) && ($to === null || $row['date'] <= $to))
            ->values();
    }

    /**
     * Post (part of) a payment to a loan through LoanService and record the allocation.
     * Returns the part that did not fit the loan's outstanding balance.
     */
    private function applyToLoan(Payment $payment, Loan $loan, float $amount, CarbonImmutable $date, ?Employee $employee, bool $fromSuspense = true): float
    {
        $loan->refresh();
        $allocation = $this->loans->allocate($loan, $amount);
        $posted = round($amount - $allocation['excess'], 2);

        if ($posted > 0) {
            if ($fromSuspense) {
                $this->ledger->journal($payment->company_id, 'SUSPENSE ALLOCATION '.$loan->loan_number, [
                    ['account' => Account::Suspense, 'branch' => $payment->branch_id, 'debit' => $posted],
                    ['account' => Account::Bank, 'bank' => $payment->bank_account_id, 'credit' => $posted],
                ], $payment, $date, $loan->branch_id, $employee);
            }

            $transaction = $this->loans->deposit($loan, $posted, $date, $payment->channel, $employee);

            PaymentAllocation::create([
                'payment_id' => $payment->id,
                'loan_id' => $loan->id,
                'loan_transaction_id' => $transaction->id,
                'employee_id' => $employee?->id,
                'amount' => $posted,
            ]);
            $payment->increment('allocated_amount', $posted);
        }

        return round($allocation['excess'], 2);
    }

    /**
     * Overpayment: the excess stays with the customer as suspense credit (Documents: Wallet / Advance / Refund).
     */
    private function holdExcess(Payment $payment, float $excess, CarbonImmutable $date, bool $alreadyInSuspense): void
    {
        $credit = Payment::create([
            'company_id' => $payment->company_id,
            'branch_id' => $payment->branch_id,
            'customer_id' => $payment->customer_id,
            'employee_id' => $payment->employee_id,
            'parent_id' => $payment->id,
            'bank_account_id' => $payment->bank_account_id,
            'source' => $payment->source,
            'channel' => $payment->channel,
            'reference' => $payment->reference,
            'phone' => $payment->phone,
            'amount' => $excess,
            'status' => PaymentStatus::Unallocated,
            'paid_on' => $date->toDateString(),
            'note' => 'Overpayment of receipt '.$payment->receipt_number,
        ]);
        $credit->forceFill(['receipt_number' => $this->receiptNumber($credit)])->save();

        if ($alreadyInSuspense) {
            /** Teller cash excess: Suspense already credited at the teller and Bank debited at confirmation. */
            $payment->increment('allocated_amount', $excess);
        } else {
            $this->receiveIntoSuspense($credit, $excess, $date);
            $payment->increment('allocated_amount', $excess);
        }
    }

    private function receiveIntoSuspense(Payment $payment, float $amount, CarbonImmutable $date, ?Employee $employee = null): void
    {
        $entry = $this->ledger->journal($payment->company_id, 'SUSPENSE '.$payment->channel.' '.($payment->transaction_id ?? $payment->receipt_number), [
            ['account' => Account::Bank, 'bank' => $payment->bank_account_id, 'debit' => $amount],
            ['account' => Account::Suspense, 'branch' => $payment->branch_id, 'credit' => $amount],
        ], $payment, $date, $payment->branch_id, $employee);

        $payment->forceFill(['journal_entry_id' => $entry->id])->save();
    }

    /**
     * Duplicate transaction_id: ignored and flagged in the audit trail.
     *
     * @return array{status: string, payment: Payment}
     */
    private function duplicate(Payment $existing, PaymentNotification $notification): array
    {
        AuditLog::create([
            'company_id' => $existing->company_id,
            'action' => 'Payment.duplicate_webhook',
            'auditable_type' => $existing->getMorphClass(),
            'auditable_id' => $existing->id,
            'context' => ['transaction_id' => $notification->transactionId, 'channel' => $notification->channel, 'amount' => $notification->amount],
            'ip_address' => request()?->ip(),
        ]);

        return ['status' => 'DUPLICATE', 'payment' => $existing];
    }

    /**
     * Match by loan reference (reference number or loan number); otherwise by phone when the
     * customer has exactly one repayable loan. Inferred: ambiguous phone matches go to suspense.
     */
    private function matchLoan(PaymentNotification $notification): ?Loan
    {
        $repayable = LoanStatus::values(...LoanStatus::repayable());

        if ($notification->reference !== null) {
            $loan = Loan::query()
                ->where(fn (Builder $query) => $query->where('reference_number', $notification->reference)->orWhere('loan_number', $notification->reference))
                ->whereIn('status', $repayable)
                ->first();

            if ($loan !== null) {
                return $loan;
            }
        }

        $phone = $this->normalisePhone($notification->phone);
        if ($phone === null) {
            return null;
        }

        $local = '0'.substr($phone, 3);
        $loans = Loan::query()
            ->whereIn('status', $repayable)
            ->whereHas('customer', fn (Builder $query) => $query->whereIn('phone', [$phone, $local, '+'.$phone]))
            ->limit(2)
            ->get();

        return $loans->count() === 1 ? $loans->first() : null;
    }

    private function normalisePhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        return match (true) {
            strlen($digits) === 12 && str_starts_with($digits, '255') => $digits,
            strlen($digits) === 10 && str_starts_with($digits, '0') => '255'.substr($digits, 1),
            strlen($digits) === 9 => '255'.$digits,
            default => null,
        };
    }

    private function defaultCompanyId(): ?int
    {
        $configured = config('integrations.payments.company_id');
        if ($configured) {
            return (int) $configured;
        }

        return Company::query()->count() === 1 ? (int) Company::query()->value('id') : null;
    }

    private function receiptNumber(Payment $payment): string
    {
        return 'RC'.str_pad((string) $payment->id, 8, '0', STR_PAD_LEFT);
    }

    /**
     * SMS the customer; a gateway failure never undoes the money movement.
     */
    private function notify(?Customer $customer, string $message): void
    {
        if ($customer === null || ! $customer->phone) {
            return;
        }

        SmsLog::create(['company_id' => $customer->company_id, 'customer_id' => $customer->id, 'phone' => $customer->phone, 'message' => $message]);

        try {
            app(SmsGateway::class)->send($customer->phone, $message);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
