<?php

namespace App\Http\Controllers\Api\V1\Hq;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Hq\HqTransactionRequest;
use App\Http\Resources\Api\V1\Hq\HqTransactionResource;
use App\Models\HqTransaction;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Headquater Transaction → Hq Account balance, Requested Transaction and Aproved Transaction.
 */
class HqTransactionController extends ApiController
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Real-time balance of every HQ account, optionally as at the filter's "to" date.
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
            'balance' => $this->ledger->balance($companyId, $account, until: $until),
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
        $query = $this->transactions()->where('status', $approved ? 'approved' : 'pending');

        if ($approved) {
            $this->applyFilters($query, $request->merge(['branch_id' => null]), 'approved_at');
        }

        $transactions = $query->get();

        return response()->json([
            'data' => HqTransactionResource::collection($transactions),
            'total' => round((float) $transactions->sum('amount'), 2),
            'total_charge' => round((float) $transactions->sum('charge'), 2),
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
     * Inferred: the live approve logic could not be observed.
     */
    public function approve(HqTransaction $hqTransaction): JsonResponse
    {
        $this->authorizeAny('hq.manage');

        DB::transaction(function () use ($hqTransaction): void {
            $transaction = HqTransaction::whereKey($hqTransaction->id)->lockForUpdate()->firstOrFail();

            if ($transaction->status !== 'pending') {
                throw ValidationException::withMessages(['amount' => 'Transaction already aproved']);
            }

            $from = Account::from($transaction->from_account);
            $amount = (float) $transaction->amount;
            $charge = (float) $transaction->charge;

            if ($this->ledger->balance($transaction->company_id, $from) < $amount + $charge) {
                throw ValidationException::withMessages(['amount' => 'Insufficient balance in '.$from->label()]);
            }

            $this->ledger->transfer($transaction->company_id, ['account' => $from], ['account' => Account::from($transaction->to_account)], $amount, 'Headquarter transaction', $transaction, $charge);

            $transaction->update(['status' => 'approved', 'approved_at' => now(), 'approved_by' => $this->currentEmployee()->id]);
        });

        return $this->message('Transaction Aproved successfully');
    }

    public function destroy(HqTransaction $hqTransaction): JsonResponse
    {
        $this->authorizeAny('hq.manage');

        if ($hqTransaction->status !== 'pending') {
            return $this->message('Aproved transaction cannot be deleted', 422);
        }

        $hqTransaction->delete();

        return $this->message('Transaction Deleted successfully');
    }

    /**
     * HQ account dropdown; with_company=1 adds COMPANY ACCOUNT (HQ expense payment source).
     */
    public function accountOptions(Request $request): JsonResponse
    {
        $this->authorizeAny('hq.manage', 'expenses.approve_hq');

        $accounts = $request->boolean('with_company') ? [Account::Company, ...Account::hqAccounts()] : Account::hqAccounts();

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
        return HqTransaction::where('company_id', $this->currentEmployee()->company_id)->with('employee')->latest('id');
    }
}
