<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Services\AccessControl;
use App\Services\Hrm\CommissionEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * HRM → Commission: branch commission pools, distribution per staff and zone manager override
 * (OVERVIEW ALL REPORT "Commission Report", "Zone Manager Commission Report", "Commission Eligibility").
 */
class CommissionController extends HrmController
{
    public function __construct(private readonly CommissionEngine $commission) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAny('payroll.approve', 'reports.financial');

        $report = $this->commission->report($this->companyId(), $this->month($request));
        $branchIds = app(AccessControl::class)->branchIds($this->currentEmployee());

        if ($branchIds !== null) {
            $report['branches'] = array_values(array_filter($report['branches'], fn (array $branch): bool => in_array((int) $branch['branch_id'], $branchIds, true)));
            $report['zone_managers'] = [];
            $report['summary'] = $this->commission->summary($report['branches']);
        }

        return response()->json(['data' => $report + ['month' => $this->month($request)->format('Y-m')]]);
    }

    public function calculate(Request $request): JsonResponse
    {
        $this->authorizeAny('payroll.approve');
        $request->validate(['period' => ['required', 'date_format:Y-m']]);

        $rows = $this->commission->calculate($this->companyId(), $this->month($request), $this->currentEmployee());

        return $this->message('Commission Calculated successfully', 200, ['data' => ['total' => round((float) $rows->sum('amount'), 2)]]);
    }
}
