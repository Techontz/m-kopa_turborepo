<?php

namespace App\Http\Controllers\Settings;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\LoanFeeCategoryRequest;
use App\Models\LedgerEntry;
use App\Models\Loan;
use App\Models\LoanCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

class LoanFeeController extends Controller
{
    /**
     * Live option values of the "Loan Fee Category" dropdown mapped to companies.loan_fee_mode.
     *
     * @var array<string, string>
     */
    private const MODES = ['LOAN PRODUCT' => 'product', 'GENERAL' => 'general'];

    public function index(): View
    {
        return view('settings.loan-fees.index', [
            'company' => $this->company(),
            'categories' => LoanCategory::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function updateMode(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'fee_category' => ['required', 'in:'.implode(',', array_keys(self::MODES))],
        ]);

        $this->company()->update(['loan_fee_mode' => self::MODES[$validated['fee_category']]]);

        return back()->with('success', 'Loan Fee Category Updated successfully');
    }

    public function updateCategory(LoanFeeCategoryRequest $request, LoanCategory $loanCategory): RedirectResponse
    {
        $loanCategory->update($request->categoryData());

        return back()->with('success', 'Loan Fee Updated successfully');
    }

    /**
     * Loan fee income: positive LOAN FEE ledger entries posted against loans at disbursement.
     * Defaults to today's income for all branches; the filter modal narrows by branch and dates.
     */
    public function income(Request $request): View
    {
        $validated = $request->validate([
            'blanch_id' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = Carbon::parse($validated['from'] ?? today());
        $to = Carbon::parse($validated['to'] ?? today());
        $branchId = $validated['blanch_id'] ?? 'all';

        $entries = LedgerEntry::query()
            ->where('company_id', $this->employee()->company_id)
            ->where('account', Account::LoanFee->value)
            ->where('amount', '>', 0)
            ->where('reference_type', (new Loan)->getMorphClass())
            ->whereDate('entry_date', '>=', $from->toDateString())
            ->whereDate('entry_date', '<=', $to->toDateString())
            ->when($branchId !== 'all' && $branchId !== '', fn ($query) => $query->where('branch_id', (int) $branchId))
            ->with(['branch', 'reference.customer'])
            ->orderBy('entry_date')
            ->orderBy('id')
            ->get();

        return view('settings.loan-fees.income', [
            'entries' => $entries,
            'total' => (float) $entries->sum('amount'),
            'branches' => $this->branches(),
        ]);
    }
}
