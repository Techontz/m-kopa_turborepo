<?php

namespace App\Http\Controllers\Api\V1\Expenses;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Expenses\AcceptExpenseRequest;
use App\Http\Requests\Api\Expenses\ExpenseRequestRequest;
use App\Http\Resources\Api\V1\Expenses\ExpenseRequestResource;
use App\Models\AuditLog;
use App\Models\ExpenseRequest;
use App\Services\ExpenseApproval;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Expense requisitions for the three live flows:
 *  - branch: Expenses → All Expenses Request / All Accept Expenses (paid from branch INTEREST A/C);
 *  - hq: Headquater Expenses → All Expenses Requested / All Aproved Expenses (paid from HQ accounts);
 *  - bank: Bank → Request Expenses (paid from the chosen bank account).
 */
class ExpenseRequestController extends ApiController
{
    /**
     * @var array<string, list<string>>
     */
    private const VIEW_PERMISSIONS = [
        'branch' => ['expenses.request', 'expenses.approve_branch', 'expenses.approve_hq', 'reports.financial'],
        'hq' => ['hq.manage', 'expenses.approve_hq'],
        'bank' => ['bank.manage'],
    ];

    /**
     * @var array<string, list<string>>
     */
    private const REQUEST_PERMISSIONS = [
        'branch' => ['expenses.request'],
        'hq' => ['hq.manage'],
        'bank' => ['bank.manage'],
    ];

    public function __construct(private readonly ExpenseApproval $approval) {}

    /**
     * status=pending (default) | accepted | all; accepted lists take the branch (incl. all) and from/to filter.
     */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'scope' => ['required', Rule::in(ExpenseApproval::SCOPES)],
            'status' => ['nullable', Rule::in(['pending', 'accepted', 'all'])],
        ]);
        $scope = $validated['scope'];
        $status = $validated['status'] ?? 'pending';
        $this->authorizeAny(...self::VIEW_PERMISSIONS[$scope]);

        $query = $this->requests($scope)->when($status !== 'all', fn (Builder $query) => $query->where('status', $status));
        $this->applyFilters($query, $request, $status === 'pending' ? null : 'request_date');

        $requests = $query->get();

        return response()->json([
            'data' => ExpenseRequestResource::collection($requests),
            'total' => round((float) $requests->sum('amount'), 2),
            'approval_limit' => $this->approval->limit($this->currentEmployee()->company_id),
        ]);
    }

    public function store(ExpenseRequestRequest $request): JsonResponse
    {
        $data = $request->requestData();
        $this->authorizeAny(...self::REQUEST_PERMISSIONS[$data['scope']]);

        if ($data['branch_id'] !== null) {
            $this->assertBranchAccessible($data['branch_id']);
        }

        $expenseRequest = ExpenseRequest::create($data + [
            'company_id' => $this->currentEmployee()->company_id,
            'employee_id' => $this->currentEmployee()->id,
            'status' => 'pending',
            'request_date' => today(),
        ]);

        return $this->message('Expenses Requested successfully', 201, ['data' => new ExpenseRequestResource($expenseRequest->load(['branch', 'expenseType', 'bankAccount', 'employee']))]);
    }

    /**
     * Accept (approve + pay). Small branch expenses: Finance; above the company limit and HQ/bank expenses: Admin.
     */
    public function accept(AcceptExpenseRequest $request, ExpenseRequest $expenseRequest): JsonResponse
    {
        $this->assertVisible($expenseRequest);

        $amount = $request->filled('req_amount') ? $request->float('req_amount') : (float) $expenseRequest->amount;
        $this->authorizeAny(...$this->approval->requiredPermissions($expenseRequest, $amount));

        $hqAccount = $expenseRequest->scope === 'hq' && $request->filled('from_account') ? Account::from($request->string('from_account')->toString()) : null;

        $this->approval->accept(
            $expenseRequest,
            $this->currentEmployee(),
            $amount,
            $request->filled('req_comment') ? $request->string('req_comment')->toString() : null,
            $hqAccount,
        );

        return $this->message('Expenses Accepted successfully');
    }

    /**
     * Reject a pending request (live trash button "Reject"). Pending requests have no ledger postings.
     */
    public function destroy(ExpenseRequest $expenseRequest): JsonResponse
    {
        $this->assertVisible($expenseRequest);

        $isOwnRequest = $expenseRequest->employee_id === $this->currentEmployee()->id;
        $canApprove = collect($this->approval->requiredPermissions($expenseRequest, (float) $expenseRequest->amount))->contains(fn (string $permission): bool => Gate::allows($permission));
        abort_unless($canApprove || ($isOwnRequest && Gate::allows(self::REQUEST_PERMISSIONS[$expenseRequest->scope][0])), 403, 'You do not have permission to perform this action.');

        if ($expenseRequest->status !== 'pending') {
            return $this->message('Accepted expenses cannot be deleted', 422);
        }

        $expenseRequest->delete();

        return $this->message('Expenses Deleted successfully');
    }

    /**
     * Company setting: branch expenses up to this amount are approved by Finance.
     */
    public function settings(): JsonResponse
    {
        $this->authorizeAny('settings.manage', 'expenses.approve_branch', 'expenses.approve_hq');

        return response()->json(['data' => ['expense_approval_limit' => $this->approval->limit($this->currentEmployee()->company_id)]]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $this->authorizeAny('settings.manage');
        $validated = $request->validate(['expense_approval_limit' => ['required', 'numeric', 'min:0']]);

        $company = $this->currentCompany();
        $before = (float) $company->expense_approval_limit;
        $this->approval->setLimit($company->id, (float) $validated['expense_approval_limit']);

        AuditLog::create([
            'company_id' => $company->id,
            'employee_id' => $this->currentEmployee()->id,
            'action' => 'Company.expense_approval_limit',
            'auditable_type' => $company->getMorphClass(),
            'auditable_id' => $company->id,
            'before' => ['expense_approval_limit' => $before],
            'after' => ['expense_approval_limit' => (float) $validated['expense_approval_limit']],
            'ip_address' => $request->ip(),
        ]);

        return $this->message('Setting Updated successfully');
    }

    /**
     * @return Builder<ExpenseRequest>
     */
    private function requests(string $scope): Builder
    {
        $query = ExpenseRequest::query()->where('scope', $scope)->with(['branch', 'expenseType', 'bankAccount', 'employee', 'approver'])->latest('id');

        return $scope === 'branch' ? $this->scoped($query) : $query->where('company_id', $this->currentEmployee()->company_id);
    }

    private function assertVisible(ExpenseRequest $expenseRequest): void
    {
        if ($expenseRequest->scope === 'branch' && $expenseRequest->branch_id !== null) {
            $this->assertBranchAccessible($expenseRequest->branch_id);
        }
    }
}
