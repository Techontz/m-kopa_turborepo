<?php

namespace App\Http\Controllers;

use App\Enums\Account;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Saving;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class SavingController extends Controller
{
    public function __construct(private readonly Ledger $ledger) {}

    public function search(): View
    {
        return view('savings.search', [
            'customers' => Customer::where('company_id', $this->employee()->company_id)->orderBy('first_name')->get(),
        ]);
    }

    public function show(Customer $customer): View
    {
        $savings = $customer->savings()->orderBy('transaction_date')->orderBy('id')->get();

        return view('savings.show', [
            'customer' => $customer->load('branch'),
            'savings' => $savings,
            'balance' => $this->customerBalance($customer),
        ]);
    }

    /**
     * Saving deposits and withdrawals move the HQ saving account of the customer's branch.
     */
    public function store(Request $request, Customer $customer): RedirectResponse
    {
        $data = $request->validate([
            'type' => ['required', 'in:deposit,withdrawal'],
            'amount' => ['required', 'numeric', 'min:1'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $amount = (float) $data['amount'];

        if ($data['type'] === 'withdrawal' && $amount > $this->customerBalance($customer) + 0.001) {
            return back()->withInput()->with('error', 'Insufficient saving balance');
        }

        DB::transaction(function () use ($customer, $data, $amount): void {
            $description = ($data['description'] ?? '') ?: ($data['type'] === 'deposit' ? 'SAVING DEPOSIT' : 'SAVING WITHDRAWAL');

            $saving = Saving::create([
                'company_id' => $customer->company_id,
                'branch_id' => $customer->branch_id,
                'customer_id' => $customer->id,
                'type' => $data['type'],
                'description' => $description,
                'amount' => $amount,
                'transaction_date' => today(),
            ]);

            $signed = $data['type'] === 'deposit' ? $amount : -$amount;
            $this->ledger->post($customer->company_id, Account::HqSaving, $signed, $description, $customer->branch_id, $saving);
        });

        return back()->with('success', $data['type'] === 'deposit' ? 'Saving Deposit successfully' : 'Saving Withdrawal successfully');
    }

    public function deposits(Request $request): View
    {
        return view('savings.deposits', [
            'savings' => $this->transactions($request, 'deposit')->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function withdrawals(Request $request): View
    {
        $withdrawals = $this->transactions($request, 'withdrawal')->get();

        return view('savings.withdrawals', [
            'withdrawals' => $withdrawals,
            'taken' => $withdrawals->reject(fn (Saving $saving): bool => $this->clearsLoan($saving)),
            'clearLoan' => $withdrawals->filter(fn (Saving $saving): bool => $this->clearsLoan($saving)),
            'branches' => $this->branches(),
        ]);
    }

    public function balance(Request $request): View
    {
        $companyId = $this->employee()->company_id;
        $branchId = $this->branchFilter($request);

        $balances = Saving::query()
            ->where('company_id', $companyId)
            ->when($branchId, fn (Builder $query, int $id) => $query->where('branch_id', $id))
            ->selectRaw("customer_id, branch_id, SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END) as balance")
            ->groupBy('customer_id', 'branch_id')
            ->with(['customer', 'branch'])
            ->get();

        /** @var Collection<int, array{branch: Branch, amount: float}> $branchBalances */
        $branchBalances = $this->branches()->map(fn (Branch $branch): array => [
            'branch' => $branch,
            'amount' => $this->ledger->balance($companyId, Account::HqSaving, $branch),
        ])->toBase();

        return view('savings.balance', [
            'balances' => $balances,
            'branchBalances' => $branchBalances,
            'branches' => $this->branches(),
        ]);
    }

    private function customerBalance(Customer $customer): float
    {
        return (float) $customer->savings()->sum(DB::raw("CASE WHEN type = 'deposit' THEN amount ELSE -amount END"));
    }

    /**
     * Withdrawals used to clear a loan are recognised by their description (inferred; the live
     * system keeps them in a separate table that could not be observed).
     */
    private function clearsLoan(Saving $saving): bool
    {
        return str_contains(strtoupper($saving->description), 'LOAN');
    }

    /**
     * @return Builder<Saving>
     */
    private function transactions(Request $request, string $type): Builder
    {
        return Saving::query()
            ->where('company_id', $this->employee()->company_id)
            ->where('type', $type)
            ->when($this->branchFilter($request), fn (Builder $query, int $id) => $query->where('branch_id', $id))
            ->when(
                $request->filled('from') && $request->filled('to'),
                fn (Builder $query) => $query->whereBetween('transaction_date', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]),
                fn (Builder $query) => $type === 'deposit' ? $query->whereDate('transaction_date', today()) : $query,
            )
            ->with(['customer', 'branch'])
            ->latest('transaction_date')
            ->latest('id');
    }

    private function branchFilter(Request $request): ?int
    {
        return $request->filled('blanch_id') && $request->input('blanch_id') !== 'all' ? $request->integer('blanch_id') : null;
    }
}
