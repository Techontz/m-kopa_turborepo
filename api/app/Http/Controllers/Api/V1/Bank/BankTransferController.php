<?php

namespace App\Http\Controllers\Api\V1\Bank;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Bank\BranchToBankRequest;
use App\Http\Requests\Api\Bank\CompanyFundTransferRequest;
use App\Http\Resources\Api\V1\Bank\BankTransferResource;
use App\Models\BankTransfer;
use App\Services\Approvals\ReserveProtection;
use App\Services\CompanyFunds;
use App\Services\Ledger;
use App\Services\Reports\Financial\CashAccounts;
use App\Services\TransferReversal;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Bank → Bank Transaction / Approved Transaction (branch → bank, request then approve),
 * Transfer Balance /Salary advance & disbursement Acc (bank → HQ account) and
 * Company Cash ↔ Bank (COMPANY ACCOUNT ↔ bank account, {@see CompanyFunds}).
 */
class BankTransferController extends ApiController
{
    public const BRANCH_TO_BANK = 'branch_to_bank';

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Pending (default) or approved branch → bank transactions; approved list takes the branch/date filter.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        $status = $request->input('status') === 'approved' ? 'approved' : 'pending';
        $query = $this->transfers(self::BRANCH_TO_BANK)->whereIn('status', $status === 'approved' ? ['approved', TransferReversal::STATUS_REVERSED] : ['pending']);

        if ($status === 'approved') {
            $this->applyFilters($query, $request, 'transfer_date');
        }

        return $this->collection($query);
    }

    public function store(BranchToBankRequest $request, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertBranchAccessible($request->integer('from_blanch_id'));

        $transfer = $funds->requestBranchToBank(
            $this->currentEmployee()->company_id,
            $request->integer('from_blanch_id'),
            Account::from($request->string('ac_type')->toString()),
            $request->integer('to_account_id'),
            $request->float('amount'),
            $this->currentEmployee(),
        );

        return $this->message('Transaction Sent successfully', 201, ['data' => new BankTransferResource($transfer->load(['branch', 'bankAccount', 'employee']))]);
    }

    /**
     * Approve a pending bank movement of any type (branch → bank, company cash ↔ bank, reserve → investment, petty cash) and post
     * it ({@see CompanyFunds::approve()}). The initiator cannot approve their own transfer (rule 6).
     */
    public function approve(BankTransfer $bankTransfer, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeDecision($bankTransfer);
        $this->assertTransferVisible($bankTransfer);

        $funds->approve($bankTransfer, $this->currentEmployee());

        return $this->message('Transaction Approved successfully');
    }

    /**
     * Reject a pending bank movement (nothing was posted); the row is kept with the reason.
     */
    public function reject(Request $request, BankTransfer $bankTransfer, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeDecision($bankTransfer);
        $this->assertTransferVisible($bankTransfer);
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $funds->reject($bankTransfer, $validated['reason'], $this->currentEmployee());

        return $this->message('Transaction Rejected successfully');
    }

    public function destroy(BankTransfer $bankTransfer): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertTransferVisible($bankTransfer);

        if ($bankTransfer->status !== 'pending') {
            return $this->message('Approved transaction cannot be deleted', 422);
        }

        $bankTransfer->delete();

        return $this->message('Transaction Deleted successfully');
    }

    /**
     * HQ reserve → Investment RESERVE A/C transfers, with the HQ reserve still to send and the Investment RESERVE A/C balance.
     */
    public function reserveToInvestmentIndex(Request $request, CashAccounts $cash): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $companyId = $this->currentEmployee()->company_id;

        return $this->collection(
            $this->applyFilters($this->transfers(CompanyFunds::RESERVE_TO_INVESTMENT), $request->merge(['branch_id' => null]), 'transfer_date'),
            ['hq_reserve_balance' => $cash->hqReserve($companyId), 'investment_reserve_balance' => $this->ledger->balance($companyId, Account::InvestmentReserve) + 0.0],
        );
    }

    /**
     * Request HQ reserve → Investment RESERVE A/C (pending). Posted only when another authorised user approves.
     */
    public function reserveToInvestmentStore(Request $request, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $validated = $request->validate(['amount' => ['required', 'numeric', 'min:1']]);

        $transfer = $funds->requestReserveToInvestment($this->currentEmployee()->company_id, (float) $validated['amount'], $this->currentEmployee());

        return $this->message('Transaction Requested successfully — awaiting approval by another authorised user', 201, ['data' => new BankTransferResource($transfer->load(['employee']))]);
    }

    /**
     * Petty cash sent to branches, with the HQ interest income still available and each branch's PETTY CASH A/C balance.
     */
    public function pettyCashIndex(Request $request, CashAccounts $cash): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $companyId = $this->currentEmployee()->company_id;

        return $this->collection(
            $this->applyFilters($this->transfers(CompanyFunds::PETTY_CASH_TO_BRANCH), $request, 'transfer_date'),
            [
                'hq_interest_balance' => $cash->hqInterest($companyId),
                // HQ is not a branch — it is the sender of petty cash, never a recipient.
                'branches' => $this->visibleBranches()->reject(fn ($branch): bool => (bool) $branch->is_head_office)->map(fn ($branch): array => [
                    'id' => (int) $branch->id,
                    'name' => $branch->name,
                    'petty_cash' => $this->ledger->balance($companyId, Account::PettyCash, $branch->id) + 0.0,
                ])->values(),
            ],
        );
    }

    /**
     * Request HQ interest income → a branch PETTY CASH A/C (pending). The branch then spends it only on expenses HQ approves.
     */
    public function pettyCashStore(Request $request, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $validated = $request->validate([
            'branch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('company_id', $this->currentEmployee()->company_id)->where('is_head_office', false)],
            'amount' => ['required', 'numeric', 'min:1'],
        ], ['branch_id.exists' => 'Petty cash can only be sent to a branch, not Head Office.']);

        $transfer = $funds->requestPettyCash($this->currentEmployee()->company_id, (int) $validated['branch_id'], (float) $validated['amount'], $this->currentEmployee());

        return $this->message('Petty cash Requested successfully — awaiting approval by another authorised user', 201, ['data' => new BankTransferResource($transfer->load(['branch', 'employee']))]);
    }

    /**
     * Company Cash ↔ Bank: movements between the COMPANY ACCOUNT and company bank accounts (both directions).
     */
    public function companyIndex(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $query = BankTransfer::query()
            ->where('company_id', $this->currentEmployee()->company_id)
            ->whereIn('type', [CompanyFunds::CASH_TO_BANK, CompanyFunds::BANK_TO_CASH])
            ->with(['bankAccount', 'employee', 'approver', 'rejectedBy', 'journalEntry', 'reversedBy', 'reversalJournalEntry'])
            ->latest('id');

        $transfers = $this->applyFilters($query, $request->merge(['branch_id' => null]), 'transfer_date')->get();
        $posted = $transfers->where('status', CompanyFunds::APPROVED);

        return response()->json([
            'data' => BankTransferResource::collection($transfers),
            'total' => round((float) $posted->sum('amount'), 2),
            'total_pending' => round((float) $transfers->where('status', CompanyFunds::PENDING)->sum('amount'), 2),
            'total_reversed' => round((float) $transfers->where('status', TransferReversal::STATUS_REVERSED)->sum('amount'), 2),
            'company_cash_balance' => $this->ledger->balance($this->currentEmployee()->company_id, Account::Company) + 0.0,
        ]);
    }

    public function companyStore(CompanyFundTransferRequest $request, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        $result = $funds->transfer(
            $this->currentEmployee()->company_id,
            $request->string('direction')->toString(),
            $request->integer('bank_account_id'),
            $request->float('amount'),
            $this->currentEmployee(),
            $request->input('reference'),
            $request->input('idempotency_key'),
        );

        return $this->message(
            $result['created'] ? 'Transfer Requested successfully — awaiting approval by another authorised user' : 'Transfer was already recorded',
            $result['created'] ? 201 : 200,
            ['data' => new BankTransferResource($result['transfer']->load(['bankAccount', 'employee', 'journalEntry']))],
        );
    }

    /**
     * Reverse a posted bank transfer of any type (branch → bank, bank → branch, bank → HQ, company cash ↔ bank): the
     * journal is mirrored exactly (charges included) and the row is kept with status "reversed".
     */
    public function reverse(Request $request, BankTransfer $bankTransfer, TransferReversal $reversals): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->authorizeAny('accounting.reverse');
        $this->assertTransferVisible($bankTransfer);
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $transfer = $reversals->reverse($bankTransfer, $validated['reason'], $this->currentEmployee());

        return $this->message('Transaction Reversed successfully', 200, ['data' => new BankTransferResource($transfer->load(['branch', 'bankAccount', 'employee', 'journalEntry', 'reversedBy', 'reversalJournalEntry']))]);
    }

    /**
     * Branch accounts that can send money to a bank ("Select Account" dropdown).
     */
    public function branchAccountOptions(): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        return response()->json(['data' => array_map(fn (Account $account): array => ['value' => $account->value, 'label' => $account->label()], ReserveProtection::withoutReserve(Account::transferableBranchAccounts()))]);
    }

    /**
     * @return Builder<BankTransfer>
     */
    private function transfers(string $type): Builder
    {
        $query = BankTransfer::query()->where('type', $type)->with(['branch', 'bankAccount', 'employee', 'approver', 'rejectedBy', 'journalEntry', 'reversedBy', 'reversalJournalEntry'])->latest('id');

        return $type === CompanyFunds::RESERVE_TO_INVESTMENT
            ? $query->where('company_id', $this->currentEmployee()->company_id)
            : $this->scoped($query);
    }

    /**
     * @param  Builder<BankTransfer>  $query
     * @param  array<string, mixed>  $extra
     */
    private function collection(Builder $query, array $extra = []): JsonResponse
    {
        $transfers = $query->get();
        $posted = $transfers->where('status', CompanyFunds::APPROVED);

        return response()->json([
            'data' => BankTransferResource::collection($transfers),
            'total' => round((float) $posted->sum('amount'), 2),
            'total_pending' => round((float) $transfers->where('status', CompanyFunds::PENDING)->sum('amount'), 2),
            'total_charge' => round((float) $posted->sum('charge'), 2),
            'total_reversed' => round((float) $transfers->where('status', TransferReversal::STATUS_REVERSED)->sum('amount'), 2),
            ...$extra,
        ]);
    }

    /**
     * Reserve → Investment transfers are decided only by Super Admin, Admin or a shareholder; every other type needs bank.manage.
     */
    private function authorizeDecision(BankTransfer $bankTransfer): void
    {
        if ($bankTransfer->type === CompanyFunds::RESERVE_TO_INVESTMENT) {
            abort_unless(CompanyFunds::canDecideReserve($this->currentEmployee()), 403, CompanyFunds::RESERVE_APPROVER_MESSAGE);

            return;
        }

        $this->authorizeAny('bank.manage');
    }

    private function assertTransferVisible(BankTransfer $bankTransfer): void
    {
        abort_unless((int) $bankTransfer->company_id === (int) $this->currentEmployee()->company_id, 404);
        if ($bankTransfer->branch_id !== null) {
            $this->assertBranchAccessible($bankTransfer->branch_id);
        }
    }
}
