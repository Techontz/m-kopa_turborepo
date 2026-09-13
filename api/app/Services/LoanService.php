<?php

namespace App\Services;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\LoanTransaction;
use App\Models\Penalty;
use App\Models\SmsLog;
use App\Models\WriteOff;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

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
            'status' => LoanStatus::Pending,
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
     * Deductions shown on the approval page ("Remain Loan Amount / Salary Advance / Penarty / Loan Fee").
     *
     * @return array{remain_loan: float, salary_advance: float, penalty: float, loan_fee: float, total: float, remain_cash: float}
     */
    public function deductions(Loan $loan): array
    {
        $customer = $loan->customer;
        $remainLoan = $customer->loans()
            ->whereKeyNot($loan->id)
            ->status(LoanStatus::Active, LoanStatus::Default)
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
        if ($loan->customer->kyc_status !== 'approved') {
            throw ValidationException::withMessages(['loan' => 'Please wait for the customer`s KYC to be Verfied!']);
        }

        DB::transaction(function () use ($loan, $approvedAmount): void {
            $loan->amount_approved = $approvedAmount;
            $this->price($loan, $approvedAmount);
            $loan->status = LoanStatus::Disbursed;
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
     * Teller cash-out of a disbursed loan: starts the repayment schedule.
     */
    public function withdraw(Loan $loan, CarbonImmutable $date, ?Employee $employee = null): void
    {
        if ($loan->status !== LoanStatus::Disbursed) {
            throw ValidationException::withMessages(['withdrow' => 'Only disbursed loans can be withdrawn.']);
        }

        DB::transaction(function () use ($loan, $date, $employee): void {
            $principal = (float) $loan->amount_approved;
            $fee = $loan->fee_deduct ? (float) $loan->loan_fee : 0;

            $this->ledger->journal($loan->company_id, 'LOAN DISBURSEMENT '.$loan->loan_number, [
                ['account' => Account::LoanReceivable, 'branch' => $loan->branch_id, 'debit' => $principal],
                ['account' => Account::Principal, 'branch' => $loan->branch_id, 'credit' => $principal],
                ['account' => Account::LoanFee, 'branch' => $loan->branch_id, 'debit' => $fee],
                ['account' => Account::FeeIncome, 'branch' => $loan->branch_id, 'credit' => $fee],
            ], $loan, $date, $loan->branch_id, $employee);

            LoanTransaction::create([
                'company_id' => $loan->company_id,
                'branch_id' => $loan->branch_id,
                'customer_id' => $loan->customer_id,
                'loan_id' => $loan->id,
                'employee_id' => $employee?->id,
                'type' => 'withdrawal',
                'description' => 'CASH WITHDRAWALS',
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
                'withdrawn_at' => $date->toDateString(),
                'end_date' => $duration->addPeriods($date, $loan->sessions)->toDateString(),
            ]);
            $loan->customer->update(['status' => 'open']);
        });
    }

    /**
     * Repayment against a loan. Cash is allocated in the business-mandated order
     * Principal → Penalty → Interest (insurance, not covered by that rule, is collected last).
     * Reserve is cut from the interest portion in real time.
     */
    public function deposit(Loan $loan, float $amount, CarbonImmutable $date, string $method = 'CASH', ?Employee $employee = null): LoanTransaction
    {
        if (! in_array($loan->status, [LoanStatus::Active, LoanStatus::Default], true)) {
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
                $loan->update(['status' => LoanStatus::Done]);
                if (! $loan->customer->loans()->status(LoanStatus::Active, LoanStatus::Default)->exists()) {
                    $loan->customer->update(['status' => 'close']);
                }
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
     * Charge penalties on overdue schedules and flag loans past their end date as default.
     * Penalty basis (the overdue instalment) is inferred; the live calculation is server-side only.
     */
    public function applyPenaltiesAndDefaults(CarbonImmutable $today): void
    {
        Loan::query()->status(LoanStatus::Active)->with(['company', 'category'])->each(function (Loan $loan) use ($today): void {
            if ($loan->category?->has_penalty) {
                foreach ($loan->schedules()->whereDate('due_date', '<', $today->toDateString())->whereColumn('paid_amount', '<', 'amount')->get() as $schedule) {
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
                    }
                }
            }

            if ($loan->end_date !== null && $loan->end_date->lt($today) && $loan->remaining_amount > 0) {
                $loan->update(['status' => LoanStatus::Default]);
                $loan->customer->update(['status' => 'out']);
            }
        });
    }

    public function payPenalty(Penalty $penalty, float $amount, CarbonImmutable $date): void
    {
        DB::transaction(function () use ($penalty, $amount, $date): void {
            $penalty->payments()->create(['amount' => $amount, 'paid_on' => $date->toDateString()]);
            $penalty->increment('paid_amount', $amount);
            $this->ledger->journal($penalty->company_id, 'PENARTY', [
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
            $loan->update(['status' => LoanStatus::WrittenOff]);
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
