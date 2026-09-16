<?php

namespace App\Http\Controllers\Api\V1\Agent;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Agent\AgentTransactionRequest;
use App\Http\Resources\Api\V1\Agent\AgentTransactionResource;
use App\Models\AgentTransaction;
use App\Models\Branch;
use App\Services\AgentTransactionService;
use App\Services\Approvals\SegregationOfDuties;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Agent → Record transaction (live admin/transaction_record) and Deposit transaction (admin/today_transaction_miamala).
 */
class AgentTransactionController extends ApiController
{
    public function __construct(
        private readonly AgentTransactionService $service,
        private readonly Ledger $ledger,
    ) {}

    /**
     * Clientless (agent) transactions (filter: branch, from/to).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAny('agent.manage');

        return AgentTransactionResource::collection(
            $this->applyFilters($this->query(), $request, 'transaction_date')->whereNull('customer_id')->get()
        );
    }

    /**
     * Customer deposits received through agents — today, or the filtered branch and dates.
     */
    public function deposits(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAny('agent.manage');

        $query = $this->applyFilters($this->query(), $request, 'transaction_date')
            ->whereNotNull('customer_id')
            ->with(['customer', 'employee']);

        if (! $request->filled('from') && ! $request->filled('to')) {
            $query->whereDate('transaction_date', today());
        }

        return AgentTransactionResource::collection($query->get());
    }

    public function store(AgentTransactionRequest $request): JsonResponse
    {
        $this->authorizeAny('agent.manage');
        $this->assertBranchAccessible($request->integer('blanch_id'));

        $transaction = $this->service->record($this->currentEmployee()->company_id, $request->transactionData(), $this->currentEmployee());

        return $this->message('Transaction Recorded successfully', 201, ['data' => new AgentTransactionResource($transaction->load(['branch', 'paymentMode']))]);
    }

    public function reverse(Request $request, AgentTransaction $agentTransaction): JsonResponse
    {
        $this->authorizeAny('agent.manage');
        $this->authorizeAny('accounting.reverse');
        $this->assertBranchAccessible($agentTransaction->branch_id);

        $data = $request->validate(['reason' => ['required', 'string', 'max:255']], ['reason.required' => 'Please enter the reason for reversal']);
        app(SegregationOfDuties::class)->assertCanReverseRecord($agentTransaction->employee_id, $this->currentEmployee());

        $this->service->reverse($agentTransaction, $data['reason'], $this->currentEmployee());

        return $this->message('Transaction Reversed successfully');
    }

    /**
     * "Balance" modal — Agent account balance of every visible branch.
     */
    public function balances(): JsonResponse
    {
        $this->authorizeAny('agent.manage');

        $companyId = $this->currentEmployee()->company_id;

        return response()->json(['data' => $this->visibleBranches()->map(fn (Branch $branch): array => [
            'branch_id' => $branch->id,
            'branch' => $branch->name,
            'amount' => $this->ledger->balance($companyId, Account::Agent, $branch),
        ])->values()]);
    }

    /**
     * @return Builder<AgentTransaction>
     */
    private function query(): Builder
    {
        return $this->scoped(AgentTransaction::query())
            ->with(['branch', 'paymentMode'])
            ->latest('transaction_date')
            ->latest('id');
    }
}
