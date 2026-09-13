<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\Employee;
use App\Models\SalaryPayment;
use App\Models\StaffDeduction;
use App\Models\StaffLoan;
use App\Models\StaffLoanPayment;
use App\Models\StaffSalaryAdvance;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Staff salary sheet, salary payment and staff loan repayment logic (HRM).
 *
 * The live server-side logic is not observable; the rules below are inferred from the
 * sheet columns and sample figures (Take Home = Salary + Allowance − Advance − Deduction − Loan Restration).
 */
class Payroll
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * One row per active employee of the company, zeros when no salary information exists.
     *
     * @return Collection<int, array{employee: Employee, salary: float, salary_advance: float, allowance: float, deduction: float, loan_restoration: float, take_home: float}>
     */
    public function sheet(int $companyId): Collection
    {
        $employees = Employee::where('company_id', $companyId)
            ->where('status', 'active')
            ->with([
                'salaryInfo',
                'salaryAdvances' => fn ($query) => $query->where('status', 'approved'),
                'allowances' => fn ($query) => $query->where('status', 'active'),
                'deductions' => fn ($query) => $query->where('status', 'active'),
                'staffLoans' => fn ($query) => $query->where('status', 'active')->withSum('payments', 'amount'),
            ])
            ->orderBy('id')
            ->get();

        return $employees->map(function (Employee $employee): array {
            $salary = (float) ($employee->salaryInfo?->salary ?? 0);
            $advance = (float) $employee->salaryAdvances->sum('amount');
            $allowance = (float) $employee->allowances->sum('amount');
            $deduction = (float) $employee->deductions->sum(fn (StaffDeduction $item): float => $this->deductionInstalment($item));
            $restoration = (float) $employee->staffLoans->sum(fn (StaffLoan $loan): float => min((float) $loan->restoration, $loan->remainingAmount()));

            return [
                'employee' => $employee,
                'salary' => $salary,
                'salary_advance' => $advance,
                'allowance' => $allowance,
                'deduction' => $deduction,
                'loan_restoration' => $restoration,
                'take_home' => $salary > 0 ? $salary + $allowance - $advance - $deduction - $restoration : 0,
            ];
        });
    }

    /**
     * Pay the current salary sheet from the branch INTEREST account of each employee.
     *
     * Inferred behaviour: only employees with salary information are paid; each gets a
     * SalaryPayment (salary slip) row, the take home is posted as an outflow of Account::Interest
     * on the employee's branch, approved salary advances are marked "done", deduction instalments
     * are added to paid_amount and loan restorations are recorded as staff loan repayments.
     *
     * @return int number of employees paid
     */
    public function pay(int $companyId, Account $fromAccount): int
    {
        $rows = $this->sheet($companyId)->filter(fn (array $row): bool => $row['employee']->salaryInfo !== null && $row['salary'] > 0);

        DB::transaction(function () use ($rows, $companyId, $fromAccount): void {
            foreach ($rows as $row) {
                /** @var Employee $employee */
                $employee = $row['employee'];

                $payment = SalaryPayment::create([
                    'company_id' => $companyId,
                    'employee_id' => $employee->id,
                    'salary' => $row['salary'],
                    'salary_advance' => $row['salary_advance'],
                    'allowance' => $row['allowance'],
                    'deduction' => $row['deduction'],
                    'loan_restoration' => $row['loan_restoration'],
                    'take_home' => $row['take_home'],
                    'phone' => $employee->phone,
                    'account_name' => $employee->salaryInfo->account_name,
                    'account_number' => $employee->salaryInfo->account_number,
                    'paid_from_account' => $fromAccount->label(),
                    'paid_on' => now(),
                ]);

                if ($row['take_home'] != 0) {
                    $this->ledger->post($companyId, $fromAccount, -$row['take_home'], "Salary payment - {$employee->full_name}", $employee->branch_id, $payment);
                }

                $employee->salaryAdvances->each(fn (StaffSalaryAdvance $advance) => $advance->update(['status' => 'done']));

                $employee->deductions->each(function (StaffDeduction $deduction): void {
                    $paid = (float) $deduction->paid_amount + $this->deductionInstalment($deduction);
                    $deduction->update(['paid_amount' => $paid, 'status' => $paid >= (float) $deduction->amount ? 'done' : 'active']);
                });

                $employee->staffLoans->each(function (StaffLoan $loan) use ($fromAccount): void {
                    $amount = min((float) $loan->restoration, $loan->remainingAmount());
                    if ($amount > 0) {
                        $this->repayFromSalary($loan, $amount, $fromAccount);
                    }
                });
            }
        });

        return $rows->count();
    }

    /**
     * Cash repayment of a staff loan: principal share back to PRINCIPAL A/C, interest share to INTEREST A/C (inferred).
     */
    public function repay(StaffLoan $loan, float $amount): StaffLoanPayment
    {
        return DB::transaction(function () use ($loan, $amount): StaffLoanPayment {
            $payment = $this->recordRepayment($loan, $amount);
            [$principal, $interest] = $this->split($loan, $amount);

            $this->ledger->post($loan->company_id, Account::Principal, $principal, 'Staff loan repayment', $loan->branch_id, $payment);
            if ($interest > 0) {
                $this->ledger->post($loan->company_id, Account::Interest, $interest, 'Staff loan interest', $loan->branch_id, $payment);
            }

            return $payment;
        });
    }

    /**
     * Restoration withheld from salary: the money never leaves the salary account, so the
     * principal share is moved from that account to PRINCIPAL A/C (interest share stays there).
     */
    private function repayFromSalary(StaffLoan $loan, float $amount, Account $salaryAccount): void
    {
        $payment = $this->recordRepayment($loan, $amount);
        [$principal] = $this->split($loan, $amount);

        $this->ledger->post($loan->company_id, $salaryAccount, -$principal, 'Staff loan restoration from salary', $loan->branch_id, $payment);
        $this->ledger->post($loan->company_id, Account::Principal, $principal, 'Staff loan restoration from salary', $loan->branch_id, $payment);
    }

    private function recordRepayment(StaffLoan $loan, float $amount): StaffLoanPayment
    {
        $payment = $loan->payments()->create(['amount' => $amount, 'paid_on' => now()]);

        if ((float) $loan->total_payable - (float) $loan->payments()->sum('amount') <= 0) {
            $loan->update(['status' => 'done']);
        }

        return $payment;
    }

    /**
     * @return array{0: float, 1: float} principal share, interest share
     */
    private function split(StaffLoan $loan, float $amount): array
    {
        $total = (float) $loan->total_payable;
        $principal = $total > 0 ? round($amount * (float) $loan->amount_approved / $total, 2) : $amount;

        return [$principal, round($amount - $principal, 2)];
    }

    private function deductionInstalment(StaffDeduction $deduction): float
    {
        return min((float) $deduction->instalment_amount, max(0, (float) $deduction->amount - (float) $deduction->paid_amount));
    }
}
