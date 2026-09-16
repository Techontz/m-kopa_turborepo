<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Models\Employee;
use App\Services\Hrm\StaffFund;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * HRM → Staff Fund: balance, statement, member balances and withdrawals.
 */
class StaffFundController extends HrmController
{
    public function __construct(private readonly StaffFund $fund) {}

    public function show(Request $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.pay');
        abort_unless($this->seesAllBranches(), 403, 'You do not have permission to perform this action.');

        $from = $request->filled('from') ? CarbonImmutable::parse($request->string('from')->toString()) : null;
        $to = $request->filled('to') ? CarbonImmutable::parse($request->string('to')->toString()) : null;

        return response()->json(['data' => $this->fund->report($this->companyId(), $from, $to)]);
    }

    public function withdraw(Request $request): JsonResponse
    {
        $this->authorizeAny('payroll.pay');

        $validated = $request->validate([
            'empl_id' => ['required', Rule::exists('employees', 'id')->where('company_id', $this->companyId())],
            'amount' => ['required', 'numeric', 'min:1'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $this->fund->withdraw(Employee::staff()->findOrFail($validated['empl_id']), (float) $validated['amount'], $validated['reason'], $this->currentEmployee());

        return $this->message('Staff Fund Withdrawal saved successfully');
    }
}
