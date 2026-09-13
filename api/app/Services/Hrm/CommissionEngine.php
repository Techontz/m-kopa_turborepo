<?php

namespace App\Services\Hrm;

use App\Enums\SalaryType;
use App\Models\AccountingPeriod;
use App\Models\Branch;
use App\Models\BranchPeriodResult;
use App\Models\CommissionAllocation;
use App\Models\Employee;
use App\Models\HrmSetting;
use App\Models\PayrollRun;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Commission engine (STAFF COMMISSION §5–9, handwritten note "COMMISSION").
 *
 *  1. Distributable profit per branch is read from branch_period_results, written by the
 *     accounting month-end close (profit − loss carry forward − 2% HQ hold).
 *  2. Commission pool = configured % × distributable profit (0 when the branch is blocked).
 *  3. Branch staff share = (staff base salary ÷ total branch commission-eligible salary) × pool.
 *  4. Zone manager override = configured % × total pools of the branches in the zone.
 *
 * HQ staff (salary type "hq") never receive commission.
 */
class CommissionEngine
{
    /**
     * The closed accounting period for a month, or null when month-end has not been run.
     */
    public function closedPeriod(int $companyId, CarbonImmutable $month): ?AccountingPeriod
    {
        $period = AccountingPeriod::where('company_id', $companyId)
            ->whereDate('period_start', $month->startOfMonth()->toDateString())
            ->first();

        if ($period === null || ! BranchPeriodResult::where('accounting_period_id', $period->id)->exists()) {
            return null;
        }

        return $period;
    }

    /**
     * Commission figures for a month: stored allocations when calculated, otherwise a preview.
     *
     * @return array{period_closed: bool, calculated: bool, locked: bool, period: array<string, mixed>|null, pool_percent: float, zone_override_percent: float, branches: list<array<string, mixed>>, zone_managers: list<array<string, mixed>>, total_commission: float}
     */
    public function report(int $companyId, CarbonImmutable $month): array
    {
        $settings = HrmSetting::forCompany($companyId);
        $period = $this->closedPeriod($companyId, $month);

        $base = [
            'period_closed' => $period !== null,
            'calculated' => false,
            'locked' => false,
            'period' => $period ? ['id' => $period->id, 'period_start' => $period->period_start->toDateString(), 'period_end' => $period->period_end->toDateString(), 'status' => $period->status] : null,
            'pool_percent' => (float) $settings->commission_pool_percent,
            'zone_override_percent' => (float) $settings->zone_override_percent,
            'branches' => [],
            'zone_managers' => [],
            'total_commission' => 0.0,
        ];

        if ($period === null) {
            return $base;
        }

        $stored = CommissionAllocation::where('accounting_period_id', $period->id)->with('employee')->get();
        $computed = $this->compute($period, $settings);

        if ($stored->isNotEmpty()) {
            $base['calculated'] = true;
            $base['locked'] = $this->isLocked($period);
            $base['pool_percent'] = (float) ($stored->first()->pool_percent ?? $settings->commission_pool_percent);
            $computed = $this->fromStored($period, $stored, $computed);
        }

        return array_merge($base, $computed);
    }

    /**
     * Persist the allocations for a closed month (replacing an earlier, unlocked calculation).
     *
     * @return Collection<int, CommissionAllocation>
     */
    public function calculate(int $companyId, CarbonImmutable $month): Collection
    {
        $period = $this->closedPeriod($companyId, $month);

        if ($period === null) {
            throw ValidationException::withMessages(['period' => 'Period not closed. Run the month-end close before calculating commission.']);
        }
        if ($this->isLocked($period)) {
            throw ValidationException::withMessages(['period' => 'Commission for this period is already in an approved payroll and cannot be changed.']);
        }

        $settings = HrmSetting::forCompany($companyId);
        $computed = $this->compute($period, $settings);

        return DB::transaction(function () use ($period, $computed): Collection {
            CommissionAllocation::where('accounting_period_id', $period->id)->delete();
            $rows = collect();

            foreach ($computed['branches'] as $branch) {
                foreach ($branch['staff'] as $line) {
                    $rows->push(CommissionAllocation::create([
                        'company_id' => $period->company_id,
                        'accounting_period_id' => $period->id,
                        'branch_id' => $branch['branch_id'],
                        'employee_id' => $line['employee_id'],
                        'kind' => CommissionAllocation::KIND_BRANCH_STAFF,
                        'distributable_profit' => $branch['distributable_profit'],
                        'pool_percent' => $computed['pool_percent'],
                        'pool_amount' => $branch['pool_amount'],
                        'base_salary' => $line['base_salary'],
                        'total_salary' => $branch['total_salary'],
                        'share_percent' => $line['share_percent'],
                        'amount' => $line['amount'],
                    ]));
                }
            }

            foreach ($computed['zone_managers'] as $line) {
                $rows->push(CommissionAllocation::create([
                    'company_id' => $period->company_id,
                    'accounting_period_id' => $period->id,
                    'branch_id' => $line['branch_id'],
                    'zone_id' => $line['zone_id'],
                    'employee_id' => $line['employee_id'],
                    'kind' => CommissionAllocation::KIND_ZONE_MANAGER,
                    'distributable_profit' => 0,
                    'pool_percent' => $line['override_percent'],
                    'pool_amount' => $line['zone_pool'],
                    'base_salary' => $line['base_salary'],
                    'total_salary' => 0,
                    'share_percent' => $line['override_percent'],
                    'amount' => $line['amount'],
                ]));
            }

            return $rows;
        });
    }

    /**
     * Commission of one employee for a month (0 when not calculated).
     */
    public function amountFor(int $companyId, int $employeeId, CarbonImmutable $month): float
    {
        $period = $this->closedPeriod($companyId, $month);

        return $period === null ? 0.0 : round((float) CommissionAllocation::where('accounting_period_id', $period->id)->where('employee_id', $employeeId)->sum('amount'), 2);
    }

    public function isLocked(AccountingPeriod $period): bool
    {
        return CommissionAllocation::where('accounting_period_id', $period->id)
            ->whereHas('payrollRun', fn ($query) => $query->where('status', '!=', PayrollRun::STATUS_DRAFT))
            ->exists();
    }

    /**
     * @return array{pool_percent: float, zone_override_percent: float, branches: list<array<string, mixed>>, zone_managers: list<array<string, mixed>>, total_commission: float}
     */
    private function compute(AccountingPeriod $period, HrmSetting $settings): array
    {
        $poolPercent = (float) $settings->commission_pool_percent;
        $overridePercent = (float) $settings->zone_override_percent;

        $results = BranchPeriodResult::where('accounting_period_id', $period->id)->with('branch')->orderBy('branch_id')->get();
        $employees = Employee::where('company_id', $period->company_id)
            ->where('status', 'active')
            ->whereHas('salaryInfo', fn ($query) => $query->where('salary', '>', 0)->where('commission_eligible', true))
            ->with('salaryInfo')
            ->get();

        $branches = $results->map(function (BranchPeriodResult $result) use ($employees, $poolPercent): array {
            $distributable = (float) $result->distributable_profit;
            $eligible = (bool) $result->commission_eligible && $distributable > 0;
            $pool = $eligible ? round($distributable * $poolPercent / 100, 2) : 0.0;

            $staff = $employees->filter(fn (Employee $employee): bool => $employee->branch_id === $result->branch_id && $employee->salaryInfo->salary_type === SalaryType::Branch->value)->values();
            $totalSalary = round((float) $staff->sum(fn (Employee $employee): float => (float) $employee->salaryInfo->salary), 2);

            $lines = [];
            $allocated = 0.0;
            foreach ($staff as $index => $employee) {
                $salary = (float) $employee->salaryInfo->salary;
                $share = $totalSalary > 0 ? $salary / $totalSalary : 0;
                $amount = $index === $staff->count() - 1 ? round($pool - $allocated, 2) : round($pool * $share, 2);
                $allocated = round($allocated + $amount, 2);
                $lines[] = [
                    'employee_id' => $employee->id,
                    'employee' => $employee->full_name,
                    'base_salary' => $salary,
                    'share_percent' => round($share * 100, 4),
                    'amount' => $pool > 0 ? $amount : 0.0,
                ];
            }

            return [
                'branch_id' => $result->branch_id,
                'branch' => $result->branch?->name,
                'zone_id' => $result->branch?->zone_id,
                'total_income' => (float) $result->total_income,
                'expenses' => (float) $result->expenses,
                'gross_profit' => (float) $result->gross_profit,
                'loss_brought_forward' => (float) $result->loss_brought_forward,
                'net_profit' => (float) $result->net_profit,
                'loss_carried_forward' => (float) $result->loss_carried_forward,
                'hq_hold_amount' => (float) $result->hq_hold_amount,
                'distributable_profit' => $distributable,
                'eligible' => $eligible,
                'blocked_reason' => $eligible ? null : ((float) $result->loss_carried_forward > 0 || (float) $result->net_profit <= 0 ? 'Loss must be recovered before commission' : 'No distributable profit'),
                'pool_amount' => $pool,
                'total_salary' => $totalSalary,
                'staff' => $lines,
            ];
        })->values();

        $zoneManagers = $employees
            ->filter(fn (Employee $employee): bool => $employee->salaryInfo->salary_type === SalaryType::ZoneManager->value && $employee->zone_id !== null)
            ->map(function (Employee $employee) use ($branches, $overridePercent): array {
                $zoneBranches = $branches->where('zone_id', $employee->zone_id);
                $zonePool = round((float) $zoneBranches->sum('pool_amount'), 2);

                return [
                    'employee_id' => $employee->id,
                    'employee' => $employee->full_name,
                    'zone_id' => $employee->zone_id,
                    'branch_id' => $employee->branch_id,
                    'base_salary' => (float) $employee->salaryInfo->salary,
                    'contributions' => $zoneBranches->map(fn (array $branch): array => ['branch' => $branch['branch'], 'pool_amount' => $branch['pool_amount']])->values()->all(),
                    'zone_pool' => $zonePool,
                    'override_percent' => $overridePercent,
                    'amount' => round($zonePool * $overridePercent / 100, 2),
                ];
            })->values();

        return [
            'pool_percent' => $poolPercent,
            'zone_override_percent' => $overridePercent,
            'branches' => $branches->all(),
            'zone_managers' => $zoneManagers->all(),
            'total_commission' => round((float) $branches->sum(fn (array $branch): float => array_sum(array_column($branch['staff'], 'amount'))) + (float) $zoneManagers->sum('amount'), 2),
        ];
    }

    /**
     * Overlay stored allocations on the computed branch figures (stored amounts win).
     *
     * @param  Collection<int, CommissionAllocation>  $stored
     * @param  array{pool_percent: float, zone_override_percent: float, branches: list<array<string, mixed>>, zone_managers: list<array<string, mixed>>, total_commission: float}  $computed
     * @return array{branches: list<array<string, mixed>>, zone_managers: list<array<string, mixed>>, total_commission: float}
     */
    private function fromStored(AccountingPeriod $period, Collection $stored, array $computed): array
    {
        $branchStaff = $stored->where('kind', CommissionAllocation::KIND_BRANCH_STAFF);

        $branches = array_map(function (array $branch) use ($branchStaff): array {
            $rows = $branchStaff->where('branch_id', $branch['branch_id']);
            if ($rows->isNotEmpty()) {
                $branch['pool_amount'] = (float) $rows->first()->pool_amount;
            }
            $branch['staff'] = $rows->map(fn (CommissionAllocation $row): array => [
                'employee_id' => $row->employee_id,
                'employee' => $row->employee?->full_name,
                'base_salary' => (float) $row->base_salary,
                'share_percent' => (float) $row->share_percent,
                'amount' => (float) $row->amount,
            ])->values()->all();

            return $branch;
        }, $computed['branches']);

        $zoneManagers = $stored->where('kind', CommissionAllocation::KIND_ZONE_MANAGER)->map(function (CommissionAllocation $row) use ($computed): array {
            $preview = collect($computed['zone_managers'])->firstWhere('employee_id', $row->employee_id);

            return [
                'employee_id' => $row->employee_id,
                'employee' => $row->employee?->full_name,
                'zone_id' => $row->zone_id,
                'branch_id' => $row->branch_id,
                'base_salary' => (float) $row->base_salary,
                'contributions' => $preview['contributions'] ?? [],
                'zone_pool' => (float) $row->pool_amount,
                'override_percent' => (float) $row->pool_percent,
                'amount' => (float) $row->amount,
            ];
        })->values()->all();

        return [
            'branches' => $branches,
            'zone_managers' => $zoneManagers,
            'total_commission' => round((float) $stored->sum('amount'), 2),
        ];
    }
}
