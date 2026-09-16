<?php

namespace App\Http\Controllers\Api\V1\Hq;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Hq\HqTransactionRequest;
use App\Http\Resources\Api\V1\Hq\HqTransactionResource;
use App\Models\ApprovalPolicy;
use App\Models\Company;
use App\Models\HqTransaction;
use App\Services\Approvals\ReserveProtection;
use App\Services\Approvals\SegregationOfDuties;
use App\Services\Ledger;
use App\Services\Reports\Financial\CashAccounts;
use App\Services\TransferReversal;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Headquarters Transaction → Hq Account balance, Requested Transaction and Approved Transaction.
 */
class HqTransactionController extends ApiController
{
    public function __construct(private readonly Ledger $ledger, private readonly CashAccounts $cash) {}

    /**
     * Real-time balance of every HQ account, optionally as at the filter's "to" date. RESERVE ACCOUNT = the whole HQ reserve
     * (every branch RESERVE A/C + the HQ RESERVE ACCOUNT, {@see CashAccounts::hqReserve()}).
     */
    public function balances(Request $request): JsonResponse
    {
        $this->authorizeAny('hq.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $until = $request->filled('to') ? CarbonImmutable::parse($request->string('to')->toString()) : null;
        $companyId = $this->currentEmployee()->company_id;

        $rows = collect(Account::hqAccounts())->map(fn (Account $account): array => [
            'account' => $account->value,
            'name' => $account->label(),
            'balance' => $account === Account::HqReserve ? $this->cash->hqReserve($companyId, $until) : $this->ledger->balance($companyId, $account, until: $until),
        ]);

        return response()->json(['data' => $rows, 'total' => round($rows->sum('balance'), 2)]);
    }

    /**
     * status=pending (default) or approved (with from/to filter on the approval date).
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('hq.manage');

        $approved = $request->input('status') === 'approved';
        $query = $this->transactions()->whereIn('status', $approved ? ['approved', TransferReversal::STATUS_REVERSED] : ['pending']);

        if ($approved) {
            $this->applyFilters($query, $request->merge(['branch_id' => null]), 'approved_at');
        }

        $transactions = $query->get();
        $posted = $transactions->where('status', '!=', TransferReversal::STATUS_REVERSED);

        return response()->json([
            'data' => HqTransactionResource::collection($transactions),
            'total' => round((float) $posted->sum('amount'), 2),
            'total_charge' => round((float) $posted->sum('charge'), 2),
            'total_reversed' => round((float) $transactions->where('status', TransferReversal::STATUS_REVERSED)->sum('amount'), 2),
        ]);
    }

    public function store(HqTransactionRequest $request): JsonResponse
    {
        $this->authorizeAny('hq.manage');

        $transaction = HqTransaction::create([
            'company_id' => $this->currentEmployee()->company_id,
            'employee_id' => $this->currentEmployee()->id,
            'from_account' => $request->string('from_account')->toString(),
            'to_account' => $request->string('to_account')->toString(),
            'amount' => $request->float('amount'),
            'charge' => $request->float('charge'),
            'status' => 'pending',
        ]);

        return $this->message('Transaction Requested successfully', 201, ['data' => new HqTransactionResource($transaction->load('employee'))]);
    }

    /**
     * Moves the amount between the two HQ accounts; the charge is taken from the source account into BANK CHARGES.
     * Inferred: the live approve logic could not be observed. Rule 6: the requester cannot approve their own transaction;
     * rule 3: nothing leaves the HQ RESERVE account.
     */
    public function approve(HqTransaction $hqTransaction, SegregationOfDuties $duties): JsonResponse
    {
        $this->authorizeAny('hq.manage');
        abort_unless((int) $hqTransaction->company_id === (int) $this->currentEmployee()->company_id, 404);

        DB::transaction(function () use ($hqTransaction, $duties): void {
            Company::whereKey($hqTransaction->company_id)->lockForUpdate()->firstOrFail();
            $transaction = HqTransaction::whereKey($hqTransaction->id)->lockForUpdate()->firstOrFail();

            if ($transaction->status !== 'pending') {
                throw ValidationException::withMessages(['amount' => 'Transaction already approved']);
            }
            $duties->assertCanApprove($transaction->employee_id, $this->currentEmployee(), 'HQ transaction', workflow: ApprovalPolicy::HQ_TRANSACTIONS);
            ReserveProtection::assertNotReserveSource($transaction->from_account, 'amount');

            $from = Account::from($transaction->from_account);
            $amount = (float) $transaction->amount;
            $charge = (float) $transaction->charge;

            if ($this->ledger->balance($transaction->company_id, $from) < $amount + $charge) {
                throw ValidationException::withMessages(['amount' => 'Insufficient balance in '.$from->label()]);
            }

            $entry = $this->ledger->transfer($transaction->company_id, ['account' => $from], ['account' => Account::from($transaction->to_account)], $amount, 'Headquarter transaction', $transaction, $charge);

            $transaction->update(['status' => 'approved', 'approved_at' => now(), 'approved_by' => $this->currentEmployee()->id, 'journal_entry_id' => $entry->id]);
        });

        return $this->message('Transaction Approved successfully');
    }

    public function destroy(HqTransaction $hqTransaction): JsonResponse
    {
        $this->authorizeAny('hq.manage');
        abort_unless((int) $hqTransaction->company_id === (int) $this->currentEmployee()->company_id, 404);

        if ($hqTransaction->status !== 'pending') {
            return $this->message('Approved transaction cannot be deleted', 422);
        }

        $hqTransaction->delete();

        return $this->message('Transaction Deleted successfully');
    }

    /**
     * Reverse an approved HQ transaction: the journal (amount and charge) is mirrored exactly and the row is kept with
     * status "reversed". Blocked when the receiving HQ account no longer holds the amount.
     */
    public function reverse(Request $request, HqTransaction $hqTransaction, TransferReversal $reversals): JsonResponse
    {
        $this->authorizeAny('hq.manage');
        $this->authorizeAny('accounting.reverse');
        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $transaction = $reversals->reverse($hqTransaction, $validated['reason'], $this->currentEmployee());

        return $this->message('Transaction Reversed successfully', 200, ['data' => new HqTransactionResource($transaction->load(['employee', 'journalEntry', 'reversedBy', 'reversalJournalEntry']))]);
    }

    /**
     * HQ account dropdown; with_company=1 adds COMPANY ACCOUNT (HQ expense payment source). Source lists
     * (direction=from, and the expense source list) leave out the HQ RESERVE account (rule 3).
     */
    public function accountOptions(Request $request): JsonResponse
    {
        $this->authorizeAny('hq.manage', 'expenses.approve_hq');

        $accounts = $request->boolean('with_company') ? [Account::Company, ...Account::hqAccounts()] : Account::hqAccounts();
        if ($request->boolean('with_company') || $request->input('direction') === 'from') {
            $accounts = ReserveProtection::withoutReserve($accounts);
        }

        return response()->json(['data' => array_map(fn (Account $account): array => [
            'value' => $account->value,
            'label' => $account->label().' - '.number_format($this->ledger->balance($this->currentEmployee()->company_id, $account)),
        ], $accounts)]);
    }

    /**
     * @return Builder<HqTransaction>
     */
    private function transactions(): Builder
    {
        return HqTransaction::where('company_id', $this->currentEmployee()->company_id)->with(['employee', 'journalEntry', 'reversedBy', 'reversalJournalEntry'])->latest('id');
    }
}
