<?php

namespace App\Http\Controllers;

use App\Services\DashboardStatistics;
use Carbon\CarbonImmutable;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(DashboardStatistics $statistics): View
    {
        $company = $this->company();
        $today = CarbonImmutable::today();

        return view('dashboard.index', [
            'headerAccounts' => $statistics->headerAccounts($company),
            'cards' => $statistics->cards($company, $today),
            'accountBalances' => $statistics->accountBalances($company),
            'branchAccounts' => $statistics->branchAccounts($company),
            'today' => $statistics->today($company, $today),
            'customerTypes' => $statistics->customerTypes($company),
        ]);
    }
}
