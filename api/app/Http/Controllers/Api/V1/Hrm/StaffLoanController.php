<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Requests\Api\Hrm\StaffLoanRequest;
use App\Http\Resources\Api\V1\Hrm\StaffLoanResource;
use App\Models\StaffLoan;
use App\Services\Hrm\StaffCredit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * HRM → Staff Loan (live admin/staff_loan, staff_loan_active). Documents: HR approves,
 * Finance disburses from the Staff Fund, recovery is automatic on payroll.
 */
class StaffLoanController extends HrmController
{
    public function __construct(private readonly StaffCredit $credit) {}

    /**
     * Pending applications, approved (awaiting disbursement) and the "Approved List" (active / done).
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.pay');

        $base = fn () => $this->applyFilters($this->scoped(StaffLoan::query())->with(['branch', 'employee', 'category'])->withSum('payments', 'amount'), $request, 'staff_loans.created_at');

        return response()->json(['data' => [
            'pending' => StaffLoanResource::collection($base()->where('status', 'pending')->orderBy('id')->get())->resolve(),
            'approved' => StaffLoanResource::collection($base()->where('status', 'approved')->orderBy('id')->get())->resolve(),
            'disbursed' => StaffLoanResource::collection($base()->whereIn('status', ['active', 'done'])->latest('id')->get())->resolve(),
        ]]);
    }

    public function active(): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.pay');

        $loans = $this->scoped(StaffLoan::query())
            ->where('status', 'active')
            ->with(['branch', 'employee', 'category', 'payments' => fn ($query) => $query->orderBy('id')])
            ->withSum('payments', 'amount')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => StaffLoanResource::collection($loans)->resolve()]);
    }

    public function store(StaffLoanRequest $request): JsonResponse
    {
        $this->authorizeAny('hrm.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        StaffLoan::create($request->loanData() + ['company_id' => $this->companyId(), 'status' => 'pending', 'requested_by' => $this->currentEmployee()->id]);

        return $this->message('Staff Loan Applied successfully', 201);
    }

    public function approve(StaffLoan $loan): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.approve');
        $this->ensureVisible($loan);

        $this->credit->approveLoan($loan, $this->currentEmployee());

        return $this->message('Staff Loan Approved successfully');
    }

    public function reject(StaffLoan $loan): JsonResponse
    {
        $this->authorizeAny('hrm.manage', 'payroll.approve');
        $this->ensureVisible($loan);

        $this->credit->rejectLoan($loan);

        return $this->message('Staff Loan Rejected successfully');
    }

    public function disburse(StaffLoan $loan): JsonResponse
    {
        $this->authorizeAny('payroll.pay');
        $this->ensureVisible($loan);

        $this->credit->disburseLoan($loan, $this->currentEmployee());

        return $this->message('Staff Loan Disbursed successfully');
    }

    /**
     * "Pay loan" modal (Deposit): cash repayment into the Staff Fund.
     */
    public function pay(Request $request, StaffLoan $loan): JsonResponse
    {
        $this->authorizeAny('payroll.pay', 'hrm.manage');
        $this->ensureVisible($loan);

        $validated = $request->validate(['amount' => ['required', 'numeric', 'min:1']]);
        $this->credit->repayLoan($loan->loadSum('payments', 'amount'), (float) $validated['amount'], $this->currentEmployee());

        return $this->message('Loan Paid successfully');
    }
}
