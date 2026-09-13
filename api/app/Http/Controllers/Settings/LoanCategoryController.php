<?php

namespace App\Http\Controllers\Settings;

use App\Enums\Duration;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\LoanCategoryRequest;
use App\Models\Branch;
use App\Models\InterestFormula;
use App\Models\LoanCategory;
use App\Models\MainCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class LoanCategoryController extends Controller
{
    public function index(): View
    {
        $categories = LoanCategory::where('company_id', $this->employee()->company_id)
            ->with(['mainCategory', 'branches' => fn ($query) => $query->orderBy('branches.id')])
            ->orderBy('id')
            ->get();

        return view('settings.loan-categories.index', ['categories' => $categories] + $this->formOptions());
    }

    public function store(LoanCategoryRequest $request): RedirectResponse
    {
        LoanCategory::create($request->categoryData() + ['company_id' => $this->employee()->company_id]);

        return back()->with('success', 'Loan Category Registered successfully');
    }

    public function edit(LoanCategory $loanCategory): View
    {
        return view('settings.loan-categories.edit', ['category' => $loanCategory] + $this->formOptions());
    }

    public function update(LoanCategoryRequest $request, LoanCategory $loanCategory): RedirectResponse
    {
        $loanCategory->update($request->categoryData());

        return redirect()->route('loan-categories.index')->with('success', 'Loan Category Updated successfully');
    }

    public function destroy(LoanCategory $loanCategory): RedirectResponse
    {
        if ($loanCategory->loans()->exists()) {
            return back()->with('error', 'Loan Category has loans and cannot be deleted');
        }

        $loanCategory->delete();

        return back()->with('success', 'Loan Category Deleted successfully');
    }

    public function assignBranches(LoanCategory $loanCategory): View
    {
        return view('settings.loan-categories.branches', [
            'category' => $loanCategory,
            'branches' => $this->branches(),
            'assignedBranches' => $loanCategory->branches()->orderBy('branches.id')->get(),
        ]);
    }

    public function attachBranch(LoanCategory $loanCategory, Branch $branch): RedirectResponse
    {
        $loanCategory->branches()->syncWithoutDetaching([$branch->id]);

        return back()->with('success', 'Branch Added successfully');
    }

    public function detachBranch(LoanCategory $loanCategory, Branch $branch): RedirectResponse
    {
        $loanCategory->branches()->detach($branch->id);

        return back()->with('success', 'Branch Removed successfully');
    }

    /**
     * @return array<string, mixed>
     */
    private function formOptions(): array
    {
        return [
            'formulas' => InterestFormula::where('is_enabled', true)->orderBy('id')->get(),
            'durations' => Duration::cases(),
            'approveLevels' => LoanCategoryRequest::APPROVE_LEVELS,
            'mainCategories' => MainCategory::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ];
    }
}
