<?php

namespace App\Services\Hrm;

use App\Enums\Account;
use App\Enums\SalaryType;
use App\Models\CommissionAllocation;
use App\Models\Employee;
use App\Models\HrmSetting;
use App\Models\PayrollItem;
use App\Models\PayrollRun;
use App\Models\SalaryPayment;
use App\Models\StaffDeduction;
use App\Models\StaffLoan;
use App\Models\StaffSalaryAdvance;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Monthly payroll engine (STAFF COMMISSION §4, §10–11, §16).
 *
 *   Gross     = Base Salary + Commission + Allowance
 *   Take Home = Gross − (Staff Fund + Salary Advance + Deduction + Loan Restoration)
 *
 * Workflow: HR generates and approves (payroll.approve) → Finance pays (payroll.pay).
 *
 * Approval (salary recognition):  Dr Salary / Allowance Expense, Dr Commission Payable (allocated commission, D1)
 *                                  or Commission Expense (legacy)   Cr Staff Payable
 * Payment:                          Dr Staff Payable   Cr Staff Fund, Staff Advance, Staff Loan, paying account
 *
 * Branch staff and zone managers are paid from the INTEREST A/C of their branch, HQ staff from the
 * COMPANY ACCOUNT (Documents: "Matumizi na Mishahara inatoka kwenye interest account", "HQ matumizi yake
 * hayatoki kwenye interest ya branches").
 */
class PayrollEngine
{
    public function __construct(
        private readonly Ledger $ledger,
        private readonly CommissionEngine $commission,
        private readonly StaffCredit $credit,
    ) {}

    public function run(int $companyId, CarbonImmutable $month): ?PayrollRun
    {
        return PayrollRun::where('company_id', $companyId)->whereDate('period', $month->startOfMonth()->toDateString())->first();
    }

    /**
     * Computed lines for every active employee with salary information.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function preview(int $companyId, CarbonImmutable $month): Collection
    {
        $settings = HrmSetting::forCompany($companyId);
        $period = $this->commission->closedPeriod($companyId, $month);
        $commissions = $period === null ? collect() : CommissionAllocation::where('accounting_period_id', $period->id)
            ->selectRaw('employee_id, SUM(amount) AS total')
            ->groupBy('employee_id')
            ->pluck('total', 'employee_id');

        $employees = Employee::staff()->where('company_id', $companyId)
            ->where('status', 'active')
            ->whereHas('salaryInfo', fn ($query) => $query->where('salary', '>', 0))
            ->with([
                'salaryInfo',
                'branch',
                'salaryAdvances' => fn ($query) => $query->where('status', 'disbursed')->orderBy('id'),
                'allowances' => fn ($query) => $query->where('status', 'active'),
                'deductions' => fn ($query) => $query->where('status', 'active'),
                'staffLoans' => fn ($query) => $query->where('status', 'active')->withSum('payments', 'amount')->orderBy('id'),
            ])
            ->orderBy('id')
            ->get();

        return $employees->map(fn (Employee $employee): array => $this->line($employee, (float) $settings->staff_fund_percent, (float) ($commissions[$employee->id] ?? 0)));
    }

    /**
     * STEP 1 "POST /payroll/generate": (re)build the draft payroll for a month. Commission is calculated
     * first when the month has been closed by accounting.
     */
    public function generate(int $companyId, CarbonImmutable $month, Employee $preparer): PayrollRun
    {
        $existing = $this->run($companyId, $month);
        if ($existing !== null && $existing->status !== PayrollRun::STATUS_DRAFT) {
            throw ValidationException::withMessages(['period' => 'Payroll for this month is already approved and can not be changed']);
        }

        return DB::transaction(function () use ($companyId, $month, $preparer, $existing): PayrollRun {
            $period = $this->commission->closedPeriod($companyId, $month);
            if ($period !== null && ! $this->commission->isLocked($period)) {
                $this->commission->calculate($companyId, $month, $preparer);
            }

            $run = $existing ?? PayrollRun::create(['company_id' => $companyId, 'period' => $month->startOfMonth()->toDateString(), 'status' => PayrollRun::STATUS_DRAFT]);
            $run->items()->delete();

            $lines = $this->preview($companyId, $month);
            foreach ($lines as $line) {
                $run->items()->create(collect($line)->except(['employee', 'branch'])->all());
            }

            if ($period !== null) {
                CommissionAllocation::where('accounting_period_id', $period->id)->update(['payroll_run_id' => $run->id]);
            }

            $run->update([
                'prepared_by' => $preparer->id,
                'commission_status' => $period === null ? 'period_not_closed' : 'calculated',
                'total_gross' => round((float) $lines->sum('gross'), 2),
                'total_deductions' => round((float) $lines->sum('total_deductions'), 2),
                'total_net' => round((float) $lines->sum('take_home'), 2),
            ]);

            return $run->fresh();
        });
    }

    /**
     * STEP 3 salary recognition: Dr expenses / Cr Staff Payable per employee. Values are frozen afterwards.
     *
     * Commission that was allocated from profit by a journal (user decision D1) is already a liability: Dr COMMISSION PAYABLE
     * (the exact branch/employee accounts the allocation credited). Commission without an allocation journal (legacy, e.g.
     * June 2026) keeps Dr COMMISSION EXPENSE.
     */
    public function approve(PayrollRun $run, Employee $approver): void
    {
        if ($run->status !== PayrollRun::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'Payroll is not a draft']);
        }
        if (! $run->items()->exists()) {
            throw ValidationException::withMessages(['status' => 'Payroll has no staff to approve']);
        }

        DB::transaction(function () use ($run, $approver): void {
            $run->load('items.employee');
            $payable = $this->allocatedCommissionPayable($run);

            foreach ($run->items as $item) {
                $branchId = $this->payingAccount($item)['branch'];
                $commission = round((float) $item->commission, 2);
                $lines = [
                    ['account' => Account::SalaryExpense, 'branch' => $branchId, 'debit' => (float) $item->base_salary],
                ];
                foreach ($payable[$item->employee_id] ?? [] as $allocationBranchId => $credited) {
                    $portion = round(min($credited, $commission), 2);
                    if ($portion <= 0) {
                        continue;
                    }
                    $lines[] = ['account' => Account::CommissionPayable, 'branch' => $allocationBranchId, 'employee' => $item->employee_id, 'debit' => $portion];
                    $commission = round($commission - $portion, 2);
                }
                $lines[] = ['account' => Account::CommissionExpense, 'branch' => $branchId, 'debit' => $commission];
                $lines[] = ['account' => Account::AllowanceExpense, 'branch' => $branchId, 'debit' => (float) $item->allowance];
                $lines[] = ['account' => Account::StaffPayable, 'employee' => $item->employee_id, 'credit' => (float) $item->gross];

                $this->ledger->journal($run->company_id, 'Salary recognition '.$run->period->format('F Y').' - '.$item->employee->full_name, $lines, $run, null, $branchId, $approver);
            }

            $run->update(['status' => PayrollRun::STATUS_APPROVED, 'approved_by' => $approver->id, 'approved_at' => now()]);
        });
    }

    /**
     * STEP 4 payment by Finance. Deductions are withheld automatically: staff fund contribution,
     * salary advance and staff loan recoveries go back to the Staff Fund A/C (or the advance's source
     * account); other deductions reduce the salary expense (inferred). The take home leaves the paying account.
     */
    public function pay(PayrollRun $run, Employee $payer): int
    {
        if ($run->status !== PayrollRun::STATUS_APPROVED) {
            throw ValidationException::withMessages(['status' => 'Payroll must be approved by HR before payment']);
        }

        return DB::transaction(function () use ($run, $payer): int {
            $run->load(['items.employee.salaryInfo']);
            $totalNet = 0.0;

            foreach ($run->items as $item) {
                $totalNet += $this->payItem($run, $item, $payer);
            }

            $run->update([
                'status' => PayrollRun::STATUS_PAID,
                'paid_by' => $payer->id,
                'paid_at' => now(),
                'total_net' => round($totalNet, 2),
                'total_deductions' => round((float) $run->items()->sum('total_deductions'), 2),
            ]);

            return $run->items->count();
        });
    }

    /**
     * Commission credited to COMMISSION PAYABLE by the standing allocation journals of the run's closed month, per employee
     * and allocation branch. Empty for a month without journal-posted allocations (legacy expense recognition).
     *
     * @return array<int, array<int, float>> employee id → branch id → amount
     */
    private function allocatedCommissionPayable(PayrollRun $run): array
    {
        $period = $this->commission->closedPeriod((int) $run->company_id, CarbonImmutable::parse($run->period->toDateString()));
        if ($period === null) {
            return [];
        }

        $payable = [];
        foreach ($this->commission->allocationJournals($period) as $entry) {
            foreach ($entry->lines as $line) {
                if ($line->account?->key === Account::CommissionPayable && $line->account->employee_id !== null) {
                    $employeeId = (int) $line->account->employee_id;
                    $branchId = (int) $line->account->branch_id;
                    $payable[$employeeId][$branchId] = round(($payable[$employeeId][$branchId] ?? 0) + (float) $line->credit - (float) $line->debit, 2);
                }
            }
        }

        return $payable;
    }

    /**
     * @return array{account: Account, branch: int|null}
     */
    public function payingAccount(PayrollItem|array $item): array
    {
        $type = is_array($item) ? $item['salary_type'] : $item->salary_type;
        $branchId = is_array($item) ? $item['branch_id'] : $item->branch_id;

        return $type === SalaryType::Hq->value || $branchId === null
            ? ['account' => Account::Company, 'branch' => null]
            : ['account' => Account::Interest, 'branch' => (int) $branchId];
    }

    private function payItem(PayrollRun $run, PayrollItem $item, Employee $payer): float
    {
        $employee = $item->employee;
        $paying = $this->payingAccount($item);
        $gross = (float) $item->gross;

        $advances = StaffSalaryAdvance::where('employee_id', $employee->id)->where('status', 'disbursed')->orderBy('id')->get();
        $loans = StaffLoan::where('employee_id', $employee->id)->where('status', 'active')->withSum('payments', 'amount')->orderBy('id')->get();
        $deductions = StaffDeduction::where('employee_id', $employee->id)->where('status', 'active')->orderBy('id')->get();

        $lines = [['account' => Account::StaffPayable, 'employee' => $employee->id, 'debit' => $gross]];
        $toFundCash = (float) $item->staff_fund;
        $lines[] = ['account' => Account::StaffFund, 'employee' => $employee->id, 'credit' => (float) $item->staff_fund];

        $advanceLeft = min((float) $item->salary_advance, (float) $advances->sum(fn (StaffSalaryAdvance $advance): float => $advance->outstandingAmount()));
        $advanceTaken = 0.0;
        foreach ($advances as $advance) {
            $portion = min($advanceLeft, $advance->outstandingAmount());
            if ($portion <= 0) {
                continue;
            }
            $advanceLeft = round($advanceLeft - $portion, 2);
            $advanceTaken += $portion;
            $recovered = round((float) $advance->recovered_amount + $portion, 2);
            $advance->update(['recovered_amount' => $recovered, 'status' => $recovered >= (float) $advance->amount ? 'done' : 'disbursed']);

            $lines[] = ['account' => Account::StaffAdvanceReceivable, 'employee' => $employee->id, 'credit' => $portion];
            if ($advance->source_account === Account::Company->value) {
                $lines[] = ['account' => Account::Company, 'debit' => $portion];
                $lines[] = $paying + ['credit' => $portion];
            } else {
                $toFundCash += $portion;
            }
        }

        $loanLeft = (float) $item->loan_restoration;
        $loanTaken = 0.0;
        foreach ($loans as $loan) {
            $portion = min($loanLeft, (float) $loan->restoration, $loan->remainingAmount());
            if ($portion <= 0) {
                continue;
            }
            $loanLeft = round($loanLeft - $portion, 2);
            $loanTaken += $portion;
            [$principal, $interest] = $this->credit->splitLoanPayment($loan, $portion);
            $this->credit->recordLoanPayment($loan, $portion);

            $lines[] = ['account' => Account::StaffLoanReceivable, 'employee' => $employee->id, 'credit' => $principal];
            $lines[] = ['account' => Account::StaffFund, 'credit' => $interest];
            $toFundCash += $portion;
        }

        $deductionLeft = (float) $item->deduction;
        $deductionTaken = 0.0;
        foreach ($deductions as $deduction) {
            $portion = min($deductionLeft, $this->deductionInstalment($deduction));
            if ($portion <= 0) {
                continue;
            }
            $deductionLeft = round($deductionLeft - $portion, 2);
            $deductionTaken += $portion;
            $paid = round((float) $deduction->paid_amount + $portion, 2);
            $deduction->update(['paid_amount' => $paid, 'status' => $paid >= (float) $deduction->amount ? 'done' : 'active']);
        }
        $lines[] = ['account' => Account::SalaryExpense, 'branch' => $paying['branch'], 'credit' => $deductionTaken];

        $totalDeductions = round((float) $item->staff_fund + $advanceTaken + $loanTaken + $deductionTaken, 2);
        $takeHome = round($gross - $totalDeductions, 2);

        $lines[] = $paying + ['credit' => $takeHome + $toFundCash];
        $lines[] = ['account' => Account::StaffFundCash, 'debit' => $toFundCash];

        $payment = SalaryPayment::create([
            'company_id' => $run->company_id,
            'employee_id' => $employee->id,
            'payroll_run_id' => $run->id,
            'branch_id' => $item->branch_id,
            'salary_type' => $item->salary_type,
            'salary' => $item->base_salary,
            'commission' => $item->commission,
            'salary_advance' => $advanceTaken,
            'allowance' => $item->allowance,
            'staff_fund' => $item->staff_fund,
            'deduction' => $deductionTaken,
            'loan_restoration' => $loanTaken,
            'take_home' => $takeHome,
            'phone' => $employee->phone,
            'account_name' => $item->account_name,
            'account_number' => $item->account_number,
            'paid_from_account' => $paying['account']->label(),
            'paid_on' => now(),
        ]);

        $this->ledger->journal($run->company_id, 'Salary payment '.$run->period->format('F Y').' - '.$employee->full_name, $lines, $payment, null, $paying['branch'], $payer);

        $item->update([
            'salary_advance' => $advanceTaken,
            'loan_restoration' => $loanTaken,
            'deduction' => $deductionTaken,
            'total_deductions' => $totalDeductions,
            'take_home' => $takeHome,
            'salary_payment_id' => $payment->id,
        ]);

        return $takeHome;
    }

    /**
     * @return array<string, mixed>
     */
    private function line(Employee $employee, float $staffFundPercent, float $commission): array
    {
        $info = $employee->salaryInfo;
        $type = $info->salary_type ?: SalaryType::Branch->value;
        $base = (float) $info->salary;
        $commission = $type === SalaryType::Hq->value ? 0.0 : round($commission, 2);
        $allowance = round((float) $employee->allowances->sum('amount'), 2);
        $gross = round($base + $commission + $allowance, 2);

        $remaining = $gross;
        $take = function (float $amount) use (&$remaining): float {
            $taken = round(max(0, min($amount, $remaining)), 2);
            $remaining = round($remaining - $taken, 2);

            return $taken;
        };

        $staffFund = $take(round($base * $staffFundPercent / 100, 2));
        $advance = $take((float) $employee->salaryAdvances->sum(fn (StaffSalaryAdvance $item): float => $item->outstandingAmount()));
        $deduction = $take((float) $employee->deductions->sum(fn (StaffDeduction $item): float => $this->deductionInstalment($item)));
        $restoration = $take((float) $employee->staffLoans->sum(fn (StaffLoan $loan): float => min((float) $loan->restoration, $loan->remainingAmount())));
        $totalDeductions = round($staffFund + $advance + $deduction + $restoration, 2);

        return [
            'employee_id' => $employee->id,
            'employee' => $employee->full_name,
            'branch_id' => $employee->branch_id,
            'branch' => $employee->branch?->name,
            'salary_type' => $type,
            'base_salary' => $base,
            'commission' => $commission,
            'allowance' => $allowance,
            'gross' => $gross,
            'staff_fund' => $staffFund,
            'salary_advance' => $advance,
            'deduction' => $deduction,
            'loan_restoration' => $restoration,
            'total_deductions' => $totalDeductions,
            'take_home' => round($gross - $totalDeductions, 2),
            'phone' => $employee->phone,
            'account_name' => $info->account_name,
            'account_number' => $info->account_number,
            'payment_method' => $info->payment_method,
        ];
    }

    private function deductionInstalment(StaffDeduction $deduction): float
    {
        return min((float) $deduction->instalment_amount, max(0, (float) $deduction->amount - (float) $deduction->paid_amount));
    }
}
