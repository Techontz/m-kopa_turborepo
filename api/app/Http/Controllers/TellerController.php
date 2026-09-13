<?php

namespace App\Http\Controllers;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanTransaction;
use App\Models\Penalty;
use App\Services\Ledger;
use App\Services\LoanService;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class TellerController extends Controller
{
    public function index(): View
    {
        return view('teller.index', ['customers' => $this->customers()]);
    }

    public function show(Customer $customer, LoanService $loans, Ledger $ledger): View
    {
        $loan = $customer->loans()
            ->whereIn('status', [LoanStatus::Active->value, LoanStatus::Default->value, LoanStatus::Disbursed->value])
            ->latest('id')
            ->first() ?? $customer->loans()->latest('id')->first();

        $today = CarbonImmutable::today();
        $companyTransactions = LoanTransaction::where('company_id', $customer->company_id);

        return view('teller.show', [
            'customer' => $customer,
            'customers' => $this->customers(),
            'loan' => $loan,
            'deductions' => $loan ? $loans->deductions($loan) : null,
            'statement' => $loan ? $this->statement($loan) : collect(),
            'penalty' => (float) Penalty::where('customer_id', $customer->id)->where('is_waived', false)->get()->sum(fn (Penalty $item): float => (float) $item->amount - (float) $item->paid_amount),
            'cashbook' => [
                'opening' => $ledger->balance($customer->company_id, Account::Principal, until: $today->subDay(), allBranches: true),
                'deposit' => (float) (clone $companyTransactions)->where('type', 'deposit')->whereDate('transaction_date', $today)->sum('amount'),
                'withdrawal' => (float) (clone $companyTransactions)->where('type', 'withdrawal')->whereDate('transaction_date', $today)->sum('amount'),
            ],
        ]);
    }

    public function deposit(Request $request, Loan $loan, LoanService $loans): RedirectResponse
    {
        $request->merge(['depost' => preg_replace('/[^\d.]/', '', (string) $request->input('depost'))]);
        $validated = $request->validate([
            'depost' => ['required', 'numeric', 'min:1'],
            'p_method' => ['required', 'string', 'max:30'],
        ]);

        try {
            $loans->deposit($loan, (float) $validated['depost'], CarbonImmutable::today(), $validated['p_method'], $this->currentEmployee());
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return back()->with('success', 'Deposit successfully');
    }

    public function withdraw(Request $request, Loan $loan, LoanService $loans): RedirectResponse
    {
        $validated = $request->validate([
            'method' => ['required', 'string', 'max:30'],
            'code' => ['required', 'digits_between:4,6'],
        ]);

        if ($loan->withdrawal_code === null || ! hash_equals($loan->withdrawal_code, (string) $validated['code'])) {
            return back()->with('error', 'Invalid withdrawal code');
        }

        try {
            $loans->withdraw($loan, CarbonImmutable::today(), $this->currentEmployee());
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        $loan->update(['withdrawal_code' => null]);

        return back()->with('success', 'Loan Withdrawal successfully');
    }

    /**
     * Running statement: Date / Description / Deposit / Withdrawal / Balance / Remain Debit / Penalty.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function statement(Loan $loan): Collection
    {
        $due = (float) $loan->total_payable + (float) $loan->insurance;
        $balance = 0.0;
        $remaining = $due;

        return $loan->transactions()->orderBy('transaction_date')->orderBy('id')->get()->map(function (LoanTransaction $transaction) use (&$balance, &$remaining, $loan): array {
            if ($transaction->type === 'deposit') {
                $balance += (float) $transaction->amount;
                $remaining -= (float) $transaction->amount;
            } else {
                $balance -= (float) $transaction->amount;
            }

            return [
                'date' => $transaction->transaction_date->toDateString(),
                'description' => $transaction->description,
                'deposit' => $transaction->type === 'deposit' ? (float) $transaction->amount : 0,
                'withdrawal' => $transaction->type === 'withdrawal' ? (float) $transaction->amount : 0,
                'balance' => $balance,
                'remain' => max(0, $remaining),
                'penalty' => (float) Penalty::where('loan_id', $loan->id)->whereDate('penalty_date', '<=', $transaction->transaction_date)->sum('amount'),
            ];
        });
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Customer>
     */
    private function customers(): \Illuminate\Database\Eloquent\Collection
    {
        return Customer::where('company_id', $this->currentEmployee()->company_id)->latest('id')->get(['id', 'first_name', 'middle_name', 'last_name', 'customer_code']);
    }
}
