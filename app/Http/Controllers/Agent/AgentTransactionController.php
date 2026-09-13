<?php

namespace App\Http\Controllers\Agent;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Models\AgentTransaction;
use App\Models\Branch;
use App\Models\PaymentMode;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class AgentTransactionController extends Controller
{
    public function __construct(private readonly Ledger $ledger) {}

    public function record(Request $request): View
    {
        $transactions = $this->query($request)
            ->whereNull('customer_id')
            ->when($request->filled('from') && $request->filled('to'), fn (Builder $query) => $query->whereBetween('transaction_date', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]))
            ->get();

        return view('agent.record', [
            'transactions' => $transactions,
            'branches' => $this->branches(),
            'modes' => PaymentMode::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
            'balances' => $this->branchBalances(),
        ]);
    }

    public function deposits(Request $request): View
    {
        $transactions = $this->query($request)
            ->whereNotNull('customer_id')
            ->with(['customer', 'employee'])
            ->when(
                $request->filled('from') && $request->filled('to'),
                fn (Builder $query) => $query->whereBetween('transaction_date', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]),
                fn (Builder $query) => $query->whereDate('transaction_date', today()),
            )
            ->get();

        return view('agent.deposits', [
            'transactions' => $transactions,
            'branches' => $this->branches(),
            'balances' => $this->branchBalances(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $companyId = $this->employee()->company_id;

        $data = $request->validate([
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'mode_id' => ['required', Rule::exists('payment_modes', 'id')->where('company_id', $companyId)],
            'agent' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:1'],
            'date' => ['required', 'date'],
            'time' => ['required', 'date_format:H:i,H:i:s'],
        ]);

        DB::transaction(function () use ($data, $companyId): void {
            $transaction = AgentTransaction::create([
                'company_id' => $companyId,
                'branch_id' => $data['blanch_id'],
                'payment_mode_id' => $data['mode_id'],
                'employee_id' => $this->employee()->id,
                'agent' => $data['agent'],
                'amount' => $data['amount'],
                'transaction_date' => $data['date'],
                'transaction_time' => $data['time'],
            ]);

            $this->ledger->post($companyId, Account::Agent, (float) $data['amount'], 'CLIENTLESS TRANSACTION', (int) $data['blanch_id'], $transaction, date: CarbonImmutable::parse($data['date']));
        });

        return back()->with('success', 'Transaction Recorded successfully');
    }

    /**
     * @return Builder<AgentTransaction>
     */
    private function query(Request $request): Builder
    {
        return AgentTransaction::query()
            ->where('company_id', $this->employee()->company_id)
            ->when($request->filled('blanch_id') && $request->input('blanch_id') !== 'all', fn (Builder $query) => $query->where('branch_id', $request->integer('blanch_id')))
            ->with(['branch', 'paymentMode'])
            ->latest('transaction_date')
            ->latest('id');
    }

    /**
     * Agent account balance of every branch ("Balance" modal).
     *
     * @return Collection<int, array{branch: Branch, amount: float}>
     */
    private function branchBalances(): Collection
    {
        $company = $this->employee()->company_id;

        return $this->branches()->map(fn (Branch $branch): array => [
            'branch' => $branch,
            'amount' => $this->ledger->balance($company, Account::Agent, $branch),
        ])->toBase();
    }
}
