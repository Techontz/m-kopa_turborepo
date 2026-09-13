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

            $this->ledger->post($loan->company_id, Account::Principal, -$principal, 'LOAN WITHDRAWAL', $loan->branch_id, $loan, date: $date);
            if ($fee > 0) {
                $this->ledger->post($loan->company_id, Account::LoanFee, $fee, 'LOAN FEE', $loan->branch_id, $loan, date: $date);
            }

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
     * Teller deposit against a loan. Splits the cash into principal, interest and reserve.
     */
    public function deposit(Loan $loan, float $amount, CarbonImmutable $date, string $method = 'CASH', ?Employee $employee = null): LoanTransaction
    {
        if (! in_array($loan->status, [LoanStatus::Active, LoanStatus::Default], true)) {
            throw ValidationException::withMessages(['depost' => 'This loan is not active.']);
        }

        return DB::transaction(function () use ($loan, $amount, $date, $method, $employee): LoanTransaction {
            $dueTotal = (float) $loan->total_payable + (float) $loan->insurance;
            $principalShare = $dueTotal > 0 ? $amount * (float) $loan->amount_approved / $dueTotal : 0;
            $insuranceShare = $dueTotal > 0 ? $amount * (float) $loan->insurance / $dueTotal : 0;
            $interestShare = $amount - $principalShare - $insuranceShare;
            $reserve = $interestShare * (float) $loan->company->reserve_percent / 100;

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
                'principal' => round($principalShare, 2),
                'interest' => round($interestShare, 2),
                'reserve' => round($reserve, 2),
                'transaction_date' => $date->toDateString(),
            ]);

            $this->ledger->post($loan->company_id, Account::Principal, $principalShare, 'LOAN RETURN', $loan->branch_id, $transaction, date: $date);
            $this->ledger->post($loan->company_id, Account::Interest, $interestShare - $reserve, 'LOAN RETURN', $loan->branch_id, $transaction, date: $date);
            if ($reserve > 0) {
                $this->ledger->post($loan->company_id, Account::Reserve, $reserve, 'RESERVE', $loan->branch_id, $transaction, date: $date);
            }
            if ($insuranceShare > 0) {
                $this->ledger->post($loan->company_id, Account::Insurance, $insuranceShare, 'INSURANCE', $loan->branch_id, $transaction, date: $date);
            }

            $this->allocateToSchedules($loan, $amount);

            if ($loan->fresh()->paid_amount >= $dueTotal - 0.5) {
                $loan->update(['status' => LoanStatus::Done]);
                if (! $loan->customer->loans()->status(LoanStatus::Active, LoanStatus::Default)->exists()) {
                    $loan->customer->update(['status' => 'close']);
                }
            }

            return $transaction;
        });
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
            $this->ledger->post($penalty->company_id, Account::Penalty, $amount, 'PENARTY', $penalty->branch_id, $penalty, date: $date);
        });
    }

    public function writeOff(Loan $loan, ?Employee $employee = null): void
    {
        DB::transaction(function () use ($loan, $employee): void {
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
