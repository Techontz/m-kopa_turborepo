<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\AccountFloatRequest;
use App\Http\Requests\Api\Capital\BranchFloatRequest;
use App\Http\Requests\Api\Capital\CompanyFloatRequest;
use App\Models\ApprovalPolicy;
use App\Models\BankAccount;
use App\Models\FloatTransfer;
use App\Services\AccessControl;
use App\Services\Approvals\SegregationOfDuties;
use App\Services\FloatService;
use App\Services\Ledger;
use App\Services\TransferReversal;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

/**
 * Capital → Float, Float Branch To Branch, Approved Float, Float Ac-Ac (live transfar_amount, float_branch_branch,
 * aproved_float, float_branch_ac_ac). Lists default to today like the live pages; the filter modal narrows them.
 *
 * Rule 6: every float is requested as PENDING and posted when a different authorised user approves it
 * (POST {floatTransfer}/approve); pending floats can be rejected (POST {floatTransfer}/reject). Lists carry
 * can_approve / approve_blocked_reason for the signed-in user; totals count posted (approved) floats only.
 */
class FloatController extends ApiController
{
    public function __construct(private readonly FloatService $floats) {}

    /**
     * Company → HQ floats (and the historic company → branch rows, which can no longer be created), with the balance of
     * every source the form offers.
     */
    public function company(Request $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $transfers = $this->transfers($request, ['company_to_hq', 'company_to_branch'])->get();

        return $this->list($transfers, [
            'company_balance' => app(Ledger::class)->balance($this->currentEmployee()->company_id, Account::Company) + 0.0,
            'sources' => $this->floatSources(),
        ]);
    }

    /**
     * Request a company → HQ PRINCIPAL A/C float. The source (Company A/C, a bank account or the Investment RESERVE A/C) is
     * chosen on the form; assets are never a source and no float ever goes to a branch.
     */
    public function storeCompany(CompanyFloatRequest $request): JsonResponse
    {
        $this->authorizeAny('float.manage');

        $transfer = $this->floats->requestCompanyToHq(
            $this->currentEmployee()->company_id,
            Account::from($request->string('from_account')->toString()),
            $request->input('bank_account_id') === null ? null : $request->integer('bank_account_id'),
            $request->float('amount'),
            $this->currentEmployee(),
        );

        return $this->message('Float Requested successfully — awaiting approval by another authorised user', 201, ['data' => ['id' => $transfer->id, 'status' => $transfer->status]]);
    }

    /**
     * "From Account" options with their balances: COMPANY ACCOUNT, each bank account, Investment RESERVE A/C.
     *
     * @return list<array{value: string, bank_account_id: int|null, label: string, balance: float}>
     */
    private function floatSources(): array
    {
        $ledger = app(Ledger::class);
        $companyId = $this->currentEmployee()->company_id;

        $sources = [['value' => Account::Company->value, 'bank_account_id' => null, 'label' => 'Company A/C', 'balance' => $ledger->balance($companyId, Account::Company) + 0.0]];

        foreach (BankAccount::where('company_id', $companyId)->orderBy('id')->get() as $bankAccount) {
            $sources[] = ['value' => Account::Bank->value, 'bank_account_id' => (int) $bankAccount->id, 'label' => $bankAccount->name, 'balance' => $ledger->balance($companyId, Account::Bank, bankAccount: $bankAccount) + 0.0];
        }

        $sources[] = ['value' => Account::InvestmentReserve->value, 'bank_account_id' => null, 'label' => Account::InvestmentReserve->label(), 'balance' => $ledger->balance($companyId, Account::InvestmentReserve) + 0.0];

        return $sources;
    }

    public function branch(): JsonResponse
    {
        $this->authorizeAny('float.manage');

        return $this->list($this->visible(FloatTransfer::query())
            ->where('type', 'branch_to_branch')
            ->where('status', 'pending')
            ->with(['fromBranch', 'toBranch', 'requester'])
            ->orderBy('id')
            ->get());
    }

    public function storeBranch(BranchFloatRequest $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible($request->integer('from_blanch_id'));

        $transfer = $this->floats->requestBranchToBranch($this->currentEmployee()->company_id, $request->integer('from_blanch_id'), $request->integer('to_blanch_id'), $request->float('trans_amount'), $this->currentEmployee());

        return $this->message('Float Transfer Requested successfully', 201, ['data' => ['id' => $transfer->id, 'status' => $transfer->status]]);
    }

    /**
     * Approve a pending float of any type and post it. The requester cannot approve their own float (rule 6).
     */
    public function approve(FloatTransfer $floatTransfer): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertFloatVisible($floatTransfer);

        $this->floats->approve($floatTransfer, $this->currentEmployee());

        return $this->message('Float Approved successfully');
    }

    /**
     * Reject a pending float (nothing was posted); the row is kept with the reason.
     */
    public function reject(Request $request, FloatTransfer $floatTransfer): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertFloatVisible($floatTransfer);
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $this->floats->reject($floatTransfer, $validated['reason'], $this->currentEmployee());

        return $this->message('Float Rejected successfully');
    }

    public function destroy(FloatTransfer $floatTransfer): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible((int) $floatTransfer->from_branch_id);

        if ($floatTransfer->status !== 'pending') {
            return $this->message('Approved transaction cannot be deleted', 422);
        }

        $floatTransfer->delete();

        return $this->message('Transaction Deleted successfully');
    }

    public function approved(Request $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->list($this->transfers($request, 'branch_to_branch')->whereIn('status', ['approved', TransferReversal::STATUS_REVERSED])->get());
    }

    /**
     * Account-to-account movements. Inferred: the live page keeps no list; recent movements are listed for reference.
     */
    public function accounts(Request $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->list($this->transfers($request, 'account_to_account')->get());
    }

    public function storeAccounts(AccountFloatRequest $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        $transfer = $this->floats->requestAccountToAccount($this->currentEmployee()->company_id, $request->integer('blanch_id'), $request->fromAccount(), $request->toAccount(), $request->float('amount'), $this->currentEmployee());

        return $this->message('Float Requested successfully — awaiting approval by another authorised user', 201, ['data' => ['id' => $transfer->id, 'status' => $transfer->status]]);
    }

    /**
     * Reverse an approved float (company → branch, branch → branch or account → account): Dr the sending account /
     * Cr the receiving account, mirroring the original journal. Blocked when the receiving account no longer holds it.
     */
    public function reverse(Request $request, FloatTransfer $floatTransfer, TransferReversal $reversals): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->authorizeAny('accounting.reverse');
        $this->assertFloatVisible($floatTransfer);
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $reversals->reverse($floatTransfer, $validated['reason'], $this->currentEmployee());

        return $this->message('Float Reversed successfully');
    }

    /**
     * Branch balances for the float forms (PRINCIPAL / INTEREST).
     */
    public function balances(): JsonResponse
    {
        $this->authorizeAny('float.manage');

        $ledger = app(Ledger::class);
        $companyId = $this->currentEmployee()->company_id;

        return response()->json(['data' => [
            'company' => $ledger->balance($companyId, Account::Company) + 0.0,
            'branches' => $this->visibleBranches()->map(fn ($branch): array => [
                'id' => $branch->id,
                'name' => $branch->name,
                'principal' => $ledger->balance($companyId, Account::Principal, $branch->id) + 0.0,
                'interest' => $ledger->balance($companyId, Account::Interest, $branch->id) + 0.0,
            ])->values(),
        ]]);
    }

    /**
     * @param  string|list<string>  $type
     * @return Builder<FloatTransfer>
     */
    private function transfers(Request $request, string|array $type): Builder
    {
        $from = CarbonImmutable::parse($request->input('from') ?: today());
        $to = CarbonImmutable::parse($request->input('to') ?: today());

        return $this->visible(FloatTransfer::query())
            ->whereIn('type', (array) $type)
            ->whereDate('transfer_date', '>=', $from->toDateString())
            ->whereDate('transfer_date', '<=', $to->toDateString())
            ->with(['fromBranch', 'toBranch', 'journalEntry', 'reversedBy', 'reversalJournalEntry', 'requester', 'approvedBy', 'rejectedBy'])
            ->orderBy('id');
    }

    private function assertFloatVisible(FloatTransfer $floatTransfer): void
    {
        abort_unless((int) $floatTransfer->company_id === (int) $this->currentEmployee()->company_id, 404);
        foreach (array_unique(array_filter([$floatTransfer->from_branch_id, $floatTransfer->to_branch_id])) as $branchId) {
            $this->assertBranchAccessible((int) $branchId);
        }
    }

    /**
     * Company scope plus, for branch/zone-scoped roles, transfers touching one of their branches.
     *
     * @param  Builder<FloatTransfer>  $query
     * @return Builder<FloatTransfer>
     */
    private function visible(Builder $query): Builder
    {
        $employee = $this->currentEmployee();
        $branchIds = app(AccessControl::class)->branchIds($employee);

        return $query->where('company_id', $employee->company_id)
            ->when($branchIds !== null, fn (Builder $query) => $query->where(fn (Builder $inner) => $inner->whereIn('from_branch_id', $branchIds)->orWhereIn('to_branch_id', $branchIds)));
    }

    /**
     * @param  Collection<int, FloatTransfer>  $transfers
     * @param  array<string, mixed>  $extra
     */
    private function list(Collection $transfers, array $extra = []): JsonResponse
    {
        $reversals = app(TransferReversal::class);
        $duties = app(SegregationOfDuties::class);
        $viewer = $this->currentEmployee();
        $permitted = Gate::allows('float.manage') && Gate::allows('accounting.reverse');
        $mayApprove = Gate::allows('float.manage');
        $reversed = $transfers->where('status', TransferReversal::STATUS_REVERSED);
        $posted = $transfers->where('status', FloatService::APPROVED);
        $pending = $transfers->where('status', FloatService::PENDING);

        return response()->json(['data' => $transfers->map(fn (FloatTransfer $transfer): array => [
            'id' => $transfer->id,
            'type' => $transfer->type,
            'from_branch' => $transfer->fromBranch?->name,
            'to_branch' => $transfer->toBranch?->name,
            'from_account' => $transfer->from_account ? Account::tryFrom($transfer->from_account)?->label() : null,
            'to_account' => $transfer->to_account ? Account::tryFrom($transfer->to_account)?->label() : null,
            'amount' => (float) $transfer->amount,
            'status' => $transfer->status,
            'date' => $transfer->transfer_date?->toDateString(),
            'journal_reference' => $transfer->journalEntry?->reference,
            'reversed_at' => $transfer->reversed_at?->toDateTimeString(),
            'reversed_by' => $transfer->reversedBy?->full_name,
            'reversal_reason' => $transfer->reversal_reason,
            'reversal_reference' => $transfer->reversalJournalEntry?->reference,
            'requested_by' => $transfer->requester?->full_name,
            'approved_by' => $transfer->approvedBy?->full_name,
            'approved_at' => $transfer->approved_at?->toDateTimeString(),
            'rejected_by' => $transfer->rejectedBy?->full_name,
            'rejected_at' => $transfer->rejected_at?->toDateTimeString(),
            'rejection_reason' => $transfer->rejection_reason,
            ...$duties->flags($transfer->requested_by, $viewer, $transfer->status === FloatService::PENDING, $mayApprove, workflow: ApprovalPolicy::FLOATS),
            'can_reject' => $transfer->status === FloatService::PENDING && $mayApprove,
            ...$reversals->flags($transfer, $permitted),
        ])->values(), 'total' => round((float) $posted->sum('amount'), 2), 'total_label' => 'Posted (approved) floats; pending, rejected and reversed floats excluded', 'total_pending' => round((float) $pending->sum('amount'), 2), 'total_reversed' => round((float) $reversed->sum('amount'), 2)] + $extra);
    }
}
