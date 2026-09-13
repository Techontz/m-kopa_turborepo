<?php

namespace App\Http\Controllers\SalaryAdvance;

use App\Http\Controllers\Controller;
use App\Http\Requests\SalaryAdvance\SalaryAdvanceCategoryRequest;
use App\Models\SalaryAdvanceCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class SalaryAdvanceCategoryController extends Controller
{
    public function index(): View
    {
        return view('salary-advance.categories', [
            'categories' => SalaryAdvanceCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(SalaryAdvanceCategoryRequest $request): RedirectResponse
    {
        SalaryAdvanceCategory::create($request->categoryData() + ['company_id' => $this->currentEmployee()->company_id]);

        return back()->with('success', 'Salary advance Category Registered successfully');
    }

    public function update(SalaryAdvanceCategoryRequest $request, SalaryAdvanceCategory $salaryAdvanceCategory): RedirectResponse
    {
        $salaryAdvanceCategory->update($request->categoryData());

        return back()->with('success', 'Salary advance Category Updated successfully');
    }

    public function destroy(SalaryAdvanceCategory $salaryAdvanceCategory): RedirectResponse
    {
        if ($salaryAdvanceCategory->salaryAdvances()->exists()) {
            return back()->with('error', 'Category has salary advance loans and cannot be deleted');
        }

        $salaryAdvanceCategory->delete();

        return back()->with('success', 'Salary advance Category Deleted successfully');
    }
}
