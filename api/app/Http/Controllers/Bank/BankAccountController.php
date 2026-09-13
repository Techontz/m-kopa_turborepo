<?php

namespace App\Http\Controllers\Bank;

use App\Http\Controllers\Controller;
use App\Http\Requests\Bank\BankAccountRequest;
use App\Models\BankAccount;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class BankAccountController extends Controller
{
    public function index(): View
    {
        return view('bank.accounts', [
            'accounts' => BankAccount::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(BankAccountRequest $request): RedirectResponse
    {
        BankAccount::create([
            'company_id' => $this->employee()->company_id,
            'name' => $request->string('ac_name')->toString(),
        ]);

        return back()->with('success', 'Account Registered successfully');
    }

    public function update(BankAccountRequest $request, BankAccount $bankAccount): RedirectResponse
    {
        $bankAccount->update(['name' => $request->string('ac_name')->toString()]);

        return back()->with('success', 'Account Updated successfully');
    }

    public function destroy(BankAccount $bankAccount): RedirectResponse
    {
        if ($bankAccount->ledgerAccounts()->whereHas('lines')->exists()) {
            return back()->with('error', 'Account has transactions and cannot be deleted');
        }

        $bankAccount->delete();

        return back()->with('success', 'Account Deleted successfully');
    }

    public function balance(): View
    {
        $accounts = BankAccount::where('company_id', $this->employee()->company_id)->orderBy('id')->get();

        return view('bank.balance', [
            'accounts' => $accounts,
            'balances' => $accounts->mapWithKeys(fn (BankAccount $account): array => [$account->id => $account->balance()]),
        ]);
    }
}
