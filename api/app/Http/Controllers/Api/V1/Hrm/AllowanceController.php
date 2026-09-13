<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Requests\Api\Hrm\StaffAllowanceRequest;
use App\Models\StaffAllowance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * HRM → Staff Allowance (live admin/staff_allowance). Active allowances are added to every payroll
 * (STAFF COMMISSION §10: Dr Allowance Expense Cr Staff Payable on approval).
 */
class AllowanceController extends HrmController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage');

        $query = $this->scoped(StaffAllowance::query())->with(['branch', 'employee']);
        $allowances = $this->applyFilters($query, $request, 'created_at')->latest('id')->get();

        return response()->json(['data' => $allowances->map(fn (StaffAllowance $allowance): array => [
            'id' => $allowance->id,
            'branch' => $allowance->branch?->name,
            'employee_id' => $allowance->employee_id,
            'employee' => $allowance->employee?->full_name,
            'amount' => (float) $allowance->amount,
            'description' => $allowance->description,
            'status' => $allowance->status,
            'created_at' => $allowance->created_at?->toDateString(),
        ])]);
    }

    public function store(StaffAllowanceRequest $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        StaffAllowance::create([
            'company_id' => $this->companyId(),
            'branch_id' => $request->integer('blanch_id'),
            'employee_id' => $request->integer('empl_id'),
            'amount' => (float) $request->input('new_amount'),
            'description' => $request->input('remaks_allow'),
            'status' => 'active',
        ]);

        return $this->message('Allowance Saved successfully', 201);
    }

    /**
     * Inferred: allowances recur monthly until HR stops them.
     */
    public function stop(StaffAllowance $allowance): JsonResponse
    {
        $this->authorizeAny('hrm.manage');
        $this->ensureVisible($allowance);

        $allowance->update(['status' => 'stopped']);

        return $this->message('Allowance Stopped successfully');
    }
}
