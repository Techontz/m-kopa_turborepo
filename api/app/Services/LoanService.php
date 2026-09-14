<?php

namespace App\Services;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\LoanTransaction;
use App\Models\Penalty;
use App\Models\SmsLog;
use App\Models\WriteOff;
use App\Services\Customers\KycStatusCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class LoanService
{
    public function __construct(
        private readonly Ledger $ledger,
        private readonly LoanCalculator $calculator,
    ) {}

    /**
     * @param  array{loan_category_id: int, group_id?: int|null, amount_applied: float, sessions: int, formula: string, fee_deduct: bool, reason: string}  $data
     */
    public function apply(Customer $customer, array $data, ?Employee $employee = null): Loan
    {
        $category = LoanCategory::findOrFail($data['loan_category_id']);
        $amount = (float) $data['amount_applied'];

        if ($amount < (float) $category->amount_from || $amount > (float) $category->amount_to) {
            throw ValidationException::withMessages(['amount_applied' => "Loan amount must be between {$category->level_label}"]);
        }

        if ($data['sessions'] < $category->repayment_from || $data['sessions'] > $category->repayment_to) {
            throw ValidationException::withMessages(['sessions' => "Number of repayments must be between {$category->repayment_from} - {$category->repayment_to}"]);
        }

        $loan = new Loan([
            'company_id' => $customer->company_id,
            'branch_id' => $customer->branch_id,
            'customer_id' => $customer->id,
            'loan_category_id' => $category->id,
            'group_id' => $data['group_id'] ?? null,
            'employee_id' => $employee?->id ?? $customer->employee_id,
            'loan_number' => $this->newLoanNumber(),
            'amount_applied' => $amount,
            'duration' => $category->duration,
            'sessions' => $data['sessions'],
            'formula' => $data['formula'],
            'fee_deduct' => $data['fee_deduct'],
            'reason' => $data['reason'],
            'interest_rate' => $category->interest_rate,
            'status' => LoanStatus::PendingManagerApproval,
        ]);

        $this->price($loan, $amount);
        $loan->save();

        return $loan;
    }

    /**
     * Recalculate the priced figures for a given principal.
     */
    public function price(Loan $loan, float $principal): void
    {
        $category = $loan->category ?? LoanCategory::findOrFail($loan->loan_category_id);
        $insurance = (float) $category->insurance;
        $figures = $this->calculator->calculate($loan->formula, $principal, (float) $loan->interest_rate, $loan->sessions, $insurance);

        $loan->fill([
            'interest_amount' => $figures['interest'],
            'total_payable' => $figures['total'],
            'restoration' => $figures['restoration'],
            'insurance' => $insurance,
            'loan_fee' => $category->feeFor($principal),
        ]);
    }

    /**
     * Deductions shown on the approval page ("Remain Loan Amount / Salary Advance / Penalty / Loan Fee").
     *
     * @return array{remain_loan: float, salary_advance: float, penalty: float, loan_fee: float, total: float, remain_cash: float}
     */
    public function deductions(Loan $loan): array
    {
        $customer = $loan->customer;
        $remainLoan = $customer->loans()
            ->whereKeyNot($loan->id)
            ->status(...LoanStatus::repayable())
            ->get()
            ->sum(fn (Loan $other): float => $other->remaining_amount);

        $salaryAdvance = (float) $customer->salaryAdvances()->where('status', 'active')->get()
            ->sum(fn ($advance): float => (float) $advance->total_payable - (float) $advance->payments()->sum('amount'));

        $penalty = (float) Penalty::where('customer_id', $customer->id)->where('is_waived', false)->get()
            ->sum(fn (Penalty $item): float => (float) $item->amount - (float) $item->paid_amount);

        $fee = $loan->fee_deduct ? (float) $loan->loan_fee : 0;
        $total = $remainLoan + $salaryAdvance + $penalty + $fee;
        $principal = (float) ($loan->amount_approved > 0 ? $loan->amount_approved : $loan->amount_applied);

        return [
            'remain_loan' => $remainLoan,
            'salary_advance' => $salaryAdvance,
            'penalty' => $penalty,
            'loan_fee' => $fee,
            'total' => $total,
            'remain_cash' => $principal - $total,
        ];
    }

    public function approve(Loan $loan, float $approvedAmount): void
    {
        if ($loan->customer->kyc_status !== KycStatusCalculator::COMPLETED) {
            throw ValidationException::withMessages(['loan' => "Please wait for the customer's KYC to be verified!"]);
        }

        DB::transaction(function () use ($loan, $approvedAmount): void {
            $loan->amount_approved = $approvedAmount;
            $this->price($loan, $approvedAmount);
            $loan->status = LoanStatus::AwaitingDisbursement;
            $loan->approved_at = now();
            $loan->withdrawal_code = (string) random_int(1000, 9999);
            $loan->save();

            $this->sendWithdrawalCode($loan);
        });
    }

    /**
     * The live system texts the customer a code that the teller must enter to cash out.
     * No SMS gateway could be observed, so the message is recorded in sms_logs.
     */
    public function sendWithdrawalCode(Loan $loan): void
    {
        SmsLog::create([
            'company_id' => $loan->company_id,
            'customer_id' => $loan->customer_id,
            'phone' => $loan->customer->phone,
            'message' => 'Mkopo wako wa TSH '.money($loan->amount_approved)." umeidhinishwa. Namba ya siri ya kutoa pesa ni {$loan->withdrawal_code}.",
        ]);
    }

    public function reject(Loan $loan): void
    {
        $loan->update(['status' => LoanStatus::Rejected]);
    }

    /**
     * Money reaches the customer (teller cash-out, or a successful Vodacom / other-channel disbursement):
     * posts the disbursement to the ledger and starts the repayment schedule.
     *
     * Posting: Dr LOAN RECEIVABLE (the customer's loan) / Cr the source account — the branch PRINCIPAL A/C (branch
     * lending cash, the default) or a company bank account. A deducted loan fee is income: with the branch source it
     * lands in the branch LOAN FEE A/C (unchanged behaviour); with a bank source it never leaves the bank, so the
     * bank is debited back the fee. Never an expense or revenue for the principal itself.
     *
     * @param  array{account: Account, branch?: int|null, bank?: int|null}|null  $source
     */
    public function withdraw(Loan $loan, CarbonImmutable $date, ?Employee $employee = null, string $description = 'CASH WITHDRAWALS', string $channel = 'cash', ?array $source = null): JournalEntry
    {
        if ($loan->status !== LoanStatus::AwaitingDisbursement) {
            throw ValidationException::withMessages(['withdrow' => 'Only disbursed loans can be withdrawn.']);
        }

        $source ??= ['account' => Account::Principal, 'branch' => $loan->branch_id];
        if (! in_array($source['account'], [Account::Principal, Account::Bank], true) || ($source['account'] === Account::Bank && empty($source['bank']))) {
            throw new InvalidArgumentException('A loan can only be disbursed from the branch PRINCIPAL A/C or a company bank account.');
        }

        return DB::transaction(function () use ($loan, $date, $employee, $description, $channel, $source): JournalEntry {
            $principal = (float) $loan->amount_approved;
            $fee = $loan->fee_deduct ? (float) $loan->loan_fee : 0;
            $feeRetainedIn = $source['account'] === Account::Bank
                ? ['account' => Account::Bank, 'bank' => $source['bank'] ?? null]
                : ['account' => Account::LoanFee, 'branch' => $loan->branch_id];

            $entry = $this->ledger->journal($loan->company_id, 'LOAN DISBURSEMENT '.$loan->loan_number, [
                ['account' => Account::LoanReceivable, 'branch' => $loan->branch_id, 'debit' => $principal],
                $source + ['credit' => $principal],
                $feeRetainedIn + ['debit' => $fee],
                ['account' => Account::FeeIncome, 'branch' => $loan->branch_id, 'credit' => $fee],
            ], $loan, $date, $loan->branch_id, $employee);

            LoanTransaction::create([
                'company_id' => $loan->company_id,
                'branch_id' => $loan->branch_id,
                'customer_id' => $loan->customer_id,
                'loan_id' => $loan->id,
                'employee_id' => $employee?->id,
                'type' => 'withdrawal',
                'description' => $description,
                'method' => strtoupper($channel),
                'amount' => $principal,
                'transaction_date' => $date->toDateString(),
            ]);

            $loan->schedules()->delete();
            $duration = $loan->duration;
            for ($session = 1; $session <= $loan->sessions; $session++) {
                $loan->schedules()->create([
                    'due_date' => $duration->addPeriods($date, $session)->toDateString(),
                    'amount' => $loan->restoration,
                ]);
            }

            $loan->update([
                'status' => LoanStatus::Active,
                'disbursement_channel' => $channel,
                'disbursed_at' => now(),
                'withdrawn_at' => $date->toDateString(),
                'end_date' => $duration->addPeriods($date, $loan->sessions)->toDateString(),
            ]);
            $loan->customer->update(['status' => 'open']);

            return $entry;
        });
    }

    /**
     * Repayment against a loan. Cash is allocated in the business-mandated order
     * Principal → Penalty → Interest (insurance, not covered by that rule, is collected last).
     * Reserve is cut from the interest portion in real time.
     */
    public function deposit(Loan $loan, float $amount, CarbonImmutable $date, string $method = 'CASH', ?Employee $employee = null): LoanTransaction
    {
        if (! in_array($loan->status, LoanStatus::repayable(), true)) {
            throw ValidationException::withMessages(['depost' => 'This loan is not active.']);
        }

        $allocation = $this->allocate($loan, $amount);
        if ($allocation['excess'] > 0.001) {
            throw ValidationException::withMessages(['depost' => 'Amount exceeds the outstanding balance of '.money($amount - $allocation['excess']).'.']);
        }

        return DB::transaction(function () use ($loan, $amount, $date, $method, $employee, $allocation): LoanTransaction {
            $reserve = round($allocation['interest'] * (float) $loan->company->reserve_percent / 100, 2);

            $transaction = LoanTransaction::create([
                'company_id' => $loan->company_id,
                'branch_id' => $loan->branch_id,
                'customer_id' => $loan->customer_id,
                'loan_id' => $loan->id,
                'employee_id' => $employee?->id,
                'type' => 'deposit',
                'description' => 'LOAN RETURN',
                'method' => $method,
                'amount' => $amount,
                'principal' => $allocation['principal'],
                'penalty' => $allocation['penalty'],
                'interest' => $allocation['interest'],
                'insurance' => $allocation['insurance'],
                'reserve' => $reserve,
                'transaction_date' => $date->toDateString(),
            ]);

            $branch = $loan->branch_id;
            $this->ledger->journal($loan->company_id, 'LOAN RETURN '.$loan->loan_number, [
                ['account' => Account::Principal, 'branch' => $branch, 'debit' => $allocation['principal']],
                ['account' => Account::LoanReceivable, 'branch' => $branch, 'credit' => $allocation['principal']],
                ['account' => Account::Penalty, 'branch' => $branch, 'debit' => $allocation['penalty']],
                ['account' => Account::PenaltyIncome, 'branch' => $branch, 'credit' => $allocation['penalty']],
                ['account' => Account::Interest, 'branch' => $branch, 'debit' => $allocation['interest'] - $reserve],
                ['account' => Account::Reserve, 'branch' => $branch, 'debit' => $reserve],
                ['account' => Account::InterestIncome, 'branch' => $branch, 'credit' => $allocation['interest']],
                ['account' => Account::Insurance, 'branch' => $branch, 'debit' => $allocation['insurance']],
                ['account' => Account::InsuranceIncome, 'branch' => $branch, 'credit' => $allocation['insurance']],
            ], $transaction, $date, $branch, $employee);

            $this->settlePenalties($loan, $allocation['penalty'], $date);
            $this->allocateToSchedules($loan, $allocation['principal'] + $allocation['interest'] + $allocation['insurance']);

            if ($this->outstanding($loan->fresh())['total'] <= 0.5) {
                $this->close($loan, $date);
            } elseif ($this->reachedTopupThreshold($loan)) {
                $this->startFreeze($loan);
            }

            return $transaction;
        });
    }

    /**
     * Outstanding balances per component.
     *
     * @return array{principal: float, penalty: float, interest: float, insurance: float, total: float}
     */
    public function outstanding(Loan $loan): array
    {
        $paid = $loan->transactions()->where('type', 'deposit')
            ->selectRaw('COALESCE(SUM(principal),0) p, COALESCE(SUM(interest),0) i, COALESCE(SUM(insurance),0) s')
            ->first();

        $principal = max(0.0, round((float) $loan->amount_approved - (float) $paid->p, 2));
        $interest = max(0.0, round((float) $loan->interest_amount - (float) $paid->i, 2));
        $insurance = max(0.0, round((float) $loan->insurance - (float) $paid->s, 2));
        $penalty = max(0.0, round((float) Penalty::where('loan_id', $loan->id)->where('is_waived', false)->selectRaw('COALESCE(SUM(amount - paid_amount),0) v')->value('v'), 2));

        return [
            'principal' => $principal,
            'penalty' => $penalty,
            'interest' => $interest,
            'insurance' => $insurance,
            'total' => round($principal + $penalty + $interest + $insurance, 2),
        ];
    }

    /**
     * Split an amount across outstanding components in the order Principal → Penalty → Interest → Insurance.
     *
     * @return array{principal: float, penalty: float, interest: float, insurance: float, excess: float}
     */
    public function allocate(Loan $loan, float $amount): array
    {
        $remaining = round($amount, 2);
        $outstanding = $this->outstanding($loan);
        $allocation = [];

        foreach (['principal', 'penalty', 'interest', 'insurance'] as $component) {
            $portion = min($remaining, $outstanding[$component]);
            $allocation[$component] = round($portion, 2);
            $remaining = round($remaining - $portion, 2);
        }

        return $allocation + ['excess' => max(0, $remaining)];
    }

    private function settlePenalties(Loan $loan, float $amount, CarbonImmutable $date): void
    {
        foreach (Penalty::where('loan_id', $loan->id)->where('is_waived', false)->whereColumn('paid_amount', '<', 'amount')->orderBy('penalty_date')->get() as $penalty) {
            if ($amount <= 0) {
                break;
            }
            $portion = min($amount, (float) $penalty->amount - (float) $penalty->paid_amount);
            $penalty->payments()->create(['amount' => $portion, 'paid_on' => $date->toDateString()]);
            $penalty->increment('paid_amount', $portion);
            $amount -= $portion;
        }
    }

    private function allocateToSchedules(Loan $loan, float $amount): void
    {
        foreach ($loan->schedules()->whereColumn('paid_amount', '<', 'amount')->get() as $schedule) {
            if ($amount <= 0) {
                break;
            }
            $portion = min($amount, (float) $schedule->amount - (float) $schedule->paid_amount);
            $schedule->increment('paid_amount', $portion);
            $amount -= $portion;
        }
    }

    /**
     * Overdue processing (Documents: "Cron Job POST /loans/overdue/process — missed payment → pending, apply penalty").
     * For every repayable loan: one penalty per missed instalment (company penalty setting: percentage of the unpaid
     * instalment or a fixed amount, only for products with penalty = YES), days past due from the oldest unpaid
     * instalment, ACTIVE ⇄ OVERDUE, and DEFAULT once the loan end date has passed with a balance (live behaviour).
     * Penalty basis (the overdue instalment) is inferred; the live calculation is server-side only.
     *
     * @return array{processed: int, penalties: int, penalty_amount: float, overdue: int, defaulted: int}
     */
    public function applyPenaltiesAndDefaults(CarbonImmutable $today): array
    {
        $summary = ['processed' => 0, 'penalties' => 0, 'penalty_amount' => 0.0, 'overdue' => 0, 'defaulted' => 0];

        Loan::query()->status(...LoanStatus::repayable())->with(['company', 'category', 'customer'])->each(function (Loan $loan) use ($today, &$summary): void {
            $summary['processed']++;
            $unpaid = $loan->schedules()->whereDate('due_date', '<', $today->toDateString())->whereColumn('paid_amount', '<', 'amount')->get();

            if ($loan->category?->has_penalty) {
                foreach ($unpaid as $schedule) {
                    $alreadyCharged = Penalty::where('loan_id', $loan->id)->whereDate('penalty_date', $schedule->due_date)->exists();
                    if ($alreadyCharged) {
                        continue;
                    }
                    $overdue = (float) $schedule->amount - (float) $schedule->paid_amount;
                    $value = (float) $loan->company->penalty_value;
                    $penalty = $loan->company->penalty_type === 'percentage' ? $overdue * $value / 100 : $value;
                    if ($penalty > 0) {
                        Penalty::create([
                            'company_id' => $loan->company_id,
                            'branch_id' => $loan->branch_id,
                            'customer_id' => $loan->customer_id,
                            'loan_id' => $loan->id,
                            'amount' => round($penalty, 2),
                            'penalty_date' => $schedule->due_date,
                        ]);
                        $summary['penalties']++;
                        $summary['penalty_amount'] += round($penalty, 2);
                    }
                }
            }

            $oldestDue = $unpaid->min('due_date');
            $daysPastDue = $oldestDue !== null ? (int) CarbonImmutable::parse($oldestDue)->diffInDays($today) : 0;
            $status = $loan->status;

            if ($loan->end_date !== null && $loan->end_date->lt($today) && $loan->remaining_amount > 0) {
                $status = LoanStatus::Default;
            } elseif ($status !== LoanStatus::Default) {
                $status = $daysPastDue > 0 ? LoanStatus::Overdue : LoanStatus::Active;
            }

            if ($status === LoanStatus::Default && $loan->status !== LoanStatus::Default) {
                $summary['defaulted']++;
                $loan->customer->update(['status' => 'out']);
            }
            if ($status === LoanStatus::Overdue) {
                $summary['overdue']++;
            }

            if ($status !== $loan->status || $daysPastDue !== (int) $loan->days_past_due) {
                $loan->update(['status' => $status, 'days_past_due' => $daysPastDue]);
            }
        });

        return $summary;
    }

    /**
     * Loan closure once fully paid (Documents: "LOAN CLOSURE → CLOSED", then "FREEZE PERIOD → cannot borrow").
     * Closure starts the re-borrowing freeze unless the top-up threshold already started it.
     */
    public function close(Loan $loan, ?CarbonImmutable $date = null): void
    {
        $loan->update([
            'status' => LoanStatus::Closed,
            'days_past_due' => 0,
            'closed_at' => now(),
        ]);
        $this->startFreeze($loan);

        if (! $loan->customer->loans()->status(...LoanStatus::repayable())->exists()) {
            $loan->customer->update(['status' => 'close']);
        }
    }

    /**
     * Share of the loan repaid, as used by the top-up rule: repayments over principal + interest + insurance.
     */
    public function paidPercent(Loan $loan): float
    {
        $totalDue = (float) $loan->amount_approved + (float) $loan->interest_amount + (float) $loan->insurance;

        return $totalDue > 0 ? round($loan->paid_amount / $totalDue * 100, 2) : 0.0;
    }

    /**
     * Repayment reached the category's top-up percent, i.e. the customer has repaid enough to qualify for another loan.
     */
    public function reachedTopupThreshold(Loan $loan): bool
    {
        $required = (float) ($loan->category?->topup_percent ?? 0);

        return $required > 0 && $this->paidPercent($loan) >= $required;
    }

    /**
     * Re-borrowing freeze (loan category "Freeze Time (Days)"). Starts at the first event that makes the customer
     * eligible to borrow again — repayment reaching the category's top-up percent, or closure (full repayment) —
     * and is recorded once: later repayments or the closure never restart it. The length is copied from the category
     * at that moment; 0 days records the event without a freeze.
     */
    public function startFreeze(Loan $loan): void
    {
        DB::transaction(function () use ($loan): void {
            $locked = Loan::whereKey($loan->id)->lockForUpdate()->firstOrFail();
            $columns = ['freeze_started_at', 'freeze_days', 'frozen_until'];

            if ($locked->freeze_started_at === null) {
                $startedAt = CarbonImmutable::now()->startOfSecond();
                $days = (int) ($loan->category?->freeze_time_days ?? 0);
                $locked->update([
                    'freeze_started_at' => $startedAt,
                    'freeze_days' => $days,
                    'frozen_until' => $days > 0 ? $startedAt->addDays($days) : null,
                ]);
            }

            $loan->forceFill($locked->only($columns))->syncOriginalAttributes($columns);
        });
    }

    public function payPenalty(Penalty $penalty, float $amount, CarbonImmutable $date): void
    {
        DB::transaction(function () use ($penalty, $amount, $date): void {
            $penalty->payments()->create(['amount' => $amount, 'paid_on' => $date->toDateString()]);
            $penalty->increment('paid_amount', $amount);
            $this->ledger->journal($penalty->company_id, 'PENALTY', [
                ['account' => Account::Penalty, 'branch' => $penalty->branch_id, 'debit' => $amount],
                ['account' => Account::PenaltyIncome, 'branch' => $penalty->branch_id, 'credit' => $amount],
            ], $penalty, $date, $penalty->branch_id);
        });
    }

    public function writeOff(Loan $loan, ?Employee $employee = null): void
    {
        DB::transaction(function () use ($loan, $employee): void {
            $principal = $this->outstanding($loan)['principal'];
            $this->ledger->journal($loan->company_id, 'WRITE-OFF '.$loan->loan_number, [
                ['account' => Account::WriteOffExpense, 'branch' => $loan->branch_id, 'debit' => $principal],
                ['account' => Account::LoanReceivable, 'branch' => $loan->branch_id, 'credit' => $principal],
            ], $loan, null, $loan->branch_id, $employee);

            WriteOff::create([
                'loan_id' => $loan->id,
                'amount' => $loan->remaining_amount,
                'employee_id' => $employee?->id,
                'written_off_on' => now()->toDateString(),
            ]);
            $loan->update(['status' => LoanStatus::WrittenOff, 'days_past_due' => 0]);
        });
    }

    private function newLoanNumber(): string
    {
        do {
            $number = (string) random_int(10000000000000, 99999999999999);
        } while (Loan::where('loan_number', $number)->exists());

        return $number;
    }
}
