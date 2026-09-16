<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Enums\Account;
use App\Http\Requests\Api\Hrm\StaffSalaryAdvanceRequest;
use App\Http\Resources\Api\V1\Hrm\StaffSalaryAdvanceResource;
use App\Models\StaffSalaryAdvance;
use App\Services\Hrm\StaffCredit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * HRM → Salary Advance (live admin/sallry_advance). Documents §13: request → approval (HR) →
 * disbursement (Finance, from Staff Fund or HQ cash) → recovery from the next salary.
 */
class SalaryAdvanceController extends HrmController
{
    public function __construct(private readonly StaffCredit $credit) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.pay');

        $base = fn () => $this->applyFilters($this->scoped(StaffSalaryAdvance::query())->with(['branch', 'employee', 'category']), $request, 'staff_salary_advances.created_at');

        return response()->json(['data' => [
            'pending' => StaffSalaryAdvanceResource::collection($base()->where('status', 'pending')->orderBy('id')->get())->resolve(),
            'approved' => StaffSalaryAdvanceResource::collection($base()->where('status', 'approved')->orderBy('id')->get())->resolve(),
            'disbursed' => StaffSalaryAdvanceResource::collection($base()->whereIn('status', ['disbursed', 'done'])->latest('id')->get())->resolve(),
        ]]);
    }

    public function store(StaffSalaryAdvanceRequest $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        $category = $request->category();

        StaffSalaryAdvance::create([
            'company_id' => $this->companyId(),
            'branch_id' => $request->integer('blanch_id'),
            'employee_id' => $request->integer('empl_id'),
            'staff_salary_advance_category_id' => $category->id,
            'amount' => (float) $request->input('advance_amount'),
            'fee' => $category->fee,
            'status' => 'pending',
            'requested_by' => $this->currentEmployee()->id,
        ]);

        return $this->message('Salary Advance Requested successfully', 201);
    }

    public function approve(StaffSalaryAdvance $advance): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.approve');
        $this->ensureVisible($advance);

        $this->credit->approveAdvance($advance, $this->currentEmployee());

        return $this->message('Salary Advance Approved successfully');
    }

    public function reject(StaffSalaryAdvance $advance): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.approve');
        $this->ensureVisible($advance);

        $this->credit->rejectAdvance($advance);

        return $this->message('Salary Advance Rejected successfully');
    }

    public function disburse(Request $request, StaffSalaryAdvance $advance): JsonResponse
    {
        $this->authorizeAny('payroll.pay');
        $this->ensureVisible($advance);

        $validated = $request->validate(['ac_id' => ['required', Rule::in([Account::StaffFundCash->value, Account::Company->value])]]);
        $this->credit->disburseAdvance($advance, Account::from($validated['ac_id']), $this->currentEmployee());

        return $this->message('Salary Advance Disbursed successfully');
    }
}
