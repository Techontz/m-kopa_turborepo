<?php

namespace App\Http\Controllers\Hq;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hq\HqTransactionRequest;
use App\Models\HqTransaction;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class HqTransactionController extends Controller
{
    public function __construct(private Ledger $ledger) {}

    /**
     * Balance of every headquarter account, optionally as at the filter's "to" date.
     */
    public function balance(Request $request): View
    {
        $until = $request->filled('to') ? $request->date('to') : null;
        $companyId = $this->currentEmployee()->company_id;

        $balances = collect(Account::hqAccounts())->mapWithKeys(fn (Account $account): array => [
            $account->label() => $this->ledger->balance($companyId, $account, until: $until),
        ]);

        return view('hq.balance', ['balances' => $balances]);
    }

    public function requests(): View
    {
        return view('hq.transactions', [
            'transactions' => $this->transactions()->where('status', 'pending')->get(),
            'hqAccounts' => Account::hqAccounts(),
            'approved' => false,
        ]);
    }

    public function store(HqTransactionRequest $request): RedirectResponse
    {
        HqTransaction::create([
            'company_id' => $this->currentEmployee()->company_id,
            'employee_id' => $this->currentEmployee()->id,
            'from_account' => $request->string('from_account')->toString(),
            'to_account' => $request->string('to_account')->toString(),
            'amount' => $request->float('amount'),
            'charge' => $request->float('charge'),
            'status' => 'pending',
        ]);

        return back()->with('success', 'Transaction Requested successfully');
    }

    /**
     * Moves the amount between the two HQ accounts; the charge is taken from the source account.
     * Inferred: the live approve logic could not be observed.
     */
    public function approve(HqTransaction $hqTransaction): RedirectResponse
    {
        if ($hqTransaction->status !== 'pending') {
            return back()->with('error', 'Transaction already aproved');
        }

        $from = Account::from($hqTransaction->from_account);
        $amount = (float) $hqTransaction->amount;
        $charge = (float) $hqTransaction->charge;

        if ($this->ledger->balance($hqTransaction->company_id, $from) < $amount + $charge) {
            return back()->with('error', 'Insufficient balance in '.$from->label());
        }

        DB::transaction(function () use ($hqTransaction, $from, $amount, $charge): void {
            $this->ledger->transfer(
                $hqTransaction->company_id,
                ['account' => $from],
                ['account' => Account::from($hqTransaction->to_account)],
                $amount,
                'Headquarter transaction',
                $hqTransaction,
                $charge,
            );

            $hqTransaction->update(['status' => 'approved', 'approved_at' => now()]);
        });

        return back()->with('success', 'Transaction Aproved successfully');
    }

    public function approved(Request $request): View
    {
        $query = $this->transactions()->where('status', 'approved');

        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('approved_at', [$request->date('from')->startOfDay(), $request->date('to')->endOfDay()]);
        }

        return view('hq.transactions', [
            'transactions' => $query->get(),
            'hqAccounts' => Account::hqAccounts(),
            'approved' => true,
        ]);
    }

    /**
     * @return Builder<HqTransaction>
     */
    private function transactions(): Builder
    {
        return HqTransaction::where('company_id', $this->currentEmployee()->company_id)->with('employee')->latest('id');
    }
}
