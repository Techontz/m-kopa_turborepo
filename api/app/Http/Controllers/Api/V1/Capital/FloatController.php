<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\AccountFloatRequest;
use App\Http\Requests\Api\Capital\BranchFloatRequest;
use App\Http\Requests\Api\Capital\CompanyFloatRequest;
use App\Models\FloatTransfer;
use App\Services\AccessControl;
use App\Services\FloatService;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Capital → Float, Float Branch To Branch, Aproved Float, Float Ac-Ac (live transfar_amount, float_branch_branch,
 * aproved_float, float_branch_ac_ac). Lists default to today like the live pages; the filter modal narrows them.
 */
class FloatController extends ApiController
{
    public function __construct(private readonly FloatService $floats) {}

    public function company(Request $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $transfers = $this->transfers($request, 'company_to_branch')
            ->when($request->filled('branch_id') && $request->input('branch_id') !== 'all', fn (Builder $query) => $query->where('to_branch_id', $request->integer('branch_id')))
            ->get();

        return $this->list($transfers, [
            'company_balance' => app(Ledger::class)->balance($this->currentEmployee()->company_id, Account::Company) + 0.0,
        ]);
    }

    public function storeCompany(CompanyFloatRequest $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        $this->floats->companyToBranch($this->currentEmployee()->company_id, $request->integer('blanch_id'), $request->float('blanch_amount'));

        return $this->message('Float Transfered successfully', 201);
    }

    public function branch(): JsonResponse
    {
        $this->authorizeAny('float.manage');

        return $this->list($this->visible(FloatTransfer::query())
            ->where('type', 'branch_to_branch')
            ->where('status', 'pending')
            ->with(['fromBranch', 'toBranch'])
            ->orderBy('id')
            ->get());
    }

    public function storeBranch(BranchFloatRequest $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible($request->integer('from_blanch_id'));

        $this->floats->requestBranchToBranch($this->currentEmployee()->company_id, $request->integer('from_blanch_id'), $request->integer('to_blanch_id'), $request->float('trans_amount'));

        return $this->message('Float Transfer Requested successfully', 201);
    }

    public function approve(FloatTransfer $floatTransfer): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible((int) $floatTransfer->from_branch_id);

        $this->floats->approve($floatTransfer);

        return $this->message('Float Aproved successfully');
    }

    public function destroy(FloatTransfer $floatTransfer): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $this->assertBranchAccessible((int) $floatTransfer->from_branch_id);

        if ($floatTransfer->status !== 'pending') {
            return $this->message('Aproved transaction cannot be deleted', 422);
        }

        $floatTransfer->delete();

        return $this->message('Transaction Deleted successfully');
    }

    public function approved(Request $request): JsonResponse
    {
        $this->authorizeAny('float.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        return $this->list($this->transfers($request, 'branch_to_branch')->where('status', 'approved')->get());
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

        $this->floats->accountToAccount($this->currentEmployee()->company_id, $request->integer('blanch_id'), $request->fromAccount(), $request->toAccount(), $request->float('amount'));

        return $this->message('Float Transfered successfully', 201);
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
     * @return Builder<FloatTransfer>
     */
    private function transfers(Request $request, string $type): Builder
    {
        $from = CarbonImmutable::parse($request->input('from') ?: today());
        $to = CarbonImmutable::parse($request->input('to') ?: today());

        return $this->visible(FloatTransfer::query())
            ->where('type', $type)
            ->whereDate('transfer_date', '>=', $from->toDateString())
            ->whereDate('transfer_date', '<=', $to->toDateString())
            ->with(['fromBranch', 'toBranch'])
            ->orderBy('id');
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
        ])->values(), 'total' => (float) $transfers->sum('amount')] + $extra);
    }
}
