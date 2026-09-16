<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\AccessControl;
use App\Services\DashboardStatistics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class DashboardController extends ApiController
{
    /**
     * Dashboard figures (live admin/index): account header, stat cards, today's summary, account modals, customer-type
     * table and the Finance dashboard KPIs. Every figure and total is computed here; the web app only displays them.
     *
     * Company money (Company A/C + bank accounts, capital, HQ and fund account balances, float sent to branches) is only
     * sent to employees whose role covers the whole company; branch- and zone-scoped employees get null, whatever their
     * permissions. For them the green card is their branch PETTY CASH A/C and every other figure covers their branches only.
     */
    public function __invoke(DashboardStatistics $statistics, AccessControl $access): JsonResponse
    {
        $this->authorizeAny('dashboard.view');

        $company = $this->currentCompany();
        $today = CarbonImmutable::today();
        $employee = $this->currentEmployee();
        $branchIds = $access->branchIds($employee);
        $seesCompanyMoney = $branchIds === null;
        $showFinance = $seesCompanyMoney && ($employee->can('accounting.view') || $employee->can('capital.view'));
        $accountBalances = $seesCompanyMoney && $employee->can('capital.view') ? $statistics->accountBalances($company) : null;

        return response()->json(['data' => [
            'header_accounts' => $showFinance ? $statistics->headerAccounts($company) : null,
            'cards' => $statistics->cards($company, $today, $branchIds),
            'account_balances' => $accountBalances,
            'account_balances_total' => $accountBalances === null ? null : round(array_sum($accountBalances), 2),
            'branch_accounts' => $showFinance ? $statistics->branchAccounts($company)->values() : null,
            'today' => $statistics->today($company, $today, $branchIds),
            'finance_kpis' => $statistics->financeKpis($employee, [
                'penalty' => $employee->can('penalties.manage'),
                'salary_advance' => $employee->can('salary_advance.manage'),
                'hq_accounts' => $seesCompanyMoney && $employee->can('hq.manage'),
                'company_accounts' => $seesCompanyMoney && $employee->can('capital.view'),
                'account_balance' => $seesCompanyMoney,
            ]),
            'customer_types' => collect($statistics->customerTypes($company, $branchIds))->map(fn (array $row): array => collect($row)->except('customers')->all())->values(),
        ]]);
    }
}
