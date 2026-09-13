<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class VisaController extends Controller
{
    public function index(Request $request): View
    {
        $customers = Customer::query()
            ->where('company_id', $this->currentEmployee()->company_id)
            ->where(fn (Builder $query) => $query->where('work_status', 'ent')->orWhereNotNull('bank_account_name'))
            ->when(
                $request->filled('blanch_id') && $request->input('blanch_id') !== 'all',
                fn (Builder $query) => $query->where('branch_id', $request->integer('blanch_id')),
            )
            ->with('branch')
            ->orderBy('first_name')
            ->get();

        return view('visa.index', [
            'customers' => $customers,
            'branches' => $this->companyBranches(),
        ]);
    }

    public function update(Request $request, Customer $customer): RedirectResponse
    {
        $data = $request->validate([
            'ac_name' => ['nullable', 'string', 'max:255'],
            'ac_password' => ['nullable', 'string', 'max:255'],
        ]);

        $customer->update([
            'bank_account_name' => $data['ac_name'] ?? null,
            'bank_password' => $data['ac_password'] ?? null,
        ]);

        return back()->with('success', 'Account Updated successfully');
    }
}
