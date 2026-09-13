<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\DashboardStatistics;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class DashboardController extends ApiController
{
    /**
     * Dashboard figures (live admin/index): account header, stat cards, today's summary,
     * account modals and customer-type table.
     */
    public function __invoke(DashboardStatistics $statistics): JsonResponse
    {
        $this->authorizeAny('dashboard.view');

        $company = $this->currentCompany();
        $today = CarbonImmutable::today();
        $showFinance = $this->currentEmployee()->can('accounting.view') || $this->currentEmployee()->can('capital.view');

        return response()->json(['data' => [
            'header_accounts' => $showFinance ? $statistics->headerAccounts($company) : null,
            'cards' => $statistics->cards($company, $today),
            'account_balances' => $this->currentEmployee()->can('capital.view') ? $statistics->accountBalances($company) : null,
            'branch_accounts' => $showFinance ? $statistics->branchAccounts($company)->values() : null,
            'today' => $statistics->today($company, $today),
            'customer_types' => collect($statistics->customerTypes($company))->map(fn (array $row): array => collect($row)->except('customers')->all())->values(),
        ]]);
    }
}
