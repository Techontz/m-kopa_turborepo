<?php

namespace App\Http\Controllers\Capital;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Models\Capital;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class CapitalController extends Controller
{
    public function index(Ledger $ledger): View
    {
        $companyId = $this->employee()->company_id;

        $shareHolders = ShareHolder::where('company_id', $companyId)
            ->with(['capitals' => fn ($query) => $query->orderBy('id')])
            ->orderBy('id')
            ->get();

        return view('capital.capitals', [
            'shareHolders' => $shareHolders,
            'shareHolderCapital' => (float) Capital::where('company_id', $companyId)->sum('amount'),
            'companyCapital' => $ledger->balance($companyId, Account::Company),
        ]);
    }

    public function store(Request $request, Ledger $ledger): RedirectResponse
    {
        $companyId = $this->employee()->company_id;

        $validated = $request->validate([
            'share_id' => ['required', Rule::exists('share_holders', 'id')->where('company_id', $companyId)],
            'amount' => ['required', 'numeric', 'min:1'],
            'pay_method' => ['required', 'in:CASH,BANK'],
            'recept' => ['nullable', 'string', 'max:50'],
            'chaque_no' => ['nullable', 'string', 'max:50'],
        ]);

        DB::transaction(function () use ($validated, $companyId, $ledger): void {
            $capital = Capital::create([
                'company_id' => $companyId,
                'share_holder_id' => $validated['share_id'],
                'amount' => $validated['amount'],
                'pay_method' => $validated['pay_method'],
                'receipt_number' => $validated['recept'] ?? null,
                'cheque_number' => $validated['chaque_no'] ?? null,
            ]);

            $ledger->post($companyId, Account::Company, (float) $validated['amount'], 'CAPITAL', reference: $capital);
        });

        return back()->with('success', 'Capital Added successfully');
    }
}
