<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Hrm\StaffLoanCategoryRequest;
use App\Models\StaffLoanCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class StaffLoanCategoryController extends Controller
{
    public function index(): View
    {
        return view('hrm.staff-loan-categories', [
            'categories' => StaffLoanCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(StaffLoanCategoryRequest $request): RedirectResponse
    {
        StaffLoanCategory::create($request->categoryData() + ['company_id' => $this->currentEmployee()->company_id]);

        return back()->with('success', 'Loan Category Saved successfully');
    }

    public function update(StaffLoanCategoryRequest $request, StaffLoanCategory $staffLoanCategory): RedirectResponse
    {
        $staffLoanCategory->update($request->categoryData());

        return back()->with('success', 'Loan Category Updated successfully');
    }

    public function destroy(StaffLoanCategory $staffLoanCategory): RedirectResponse
    {
        if ($staffLoanCategory->staffLoans()->exists()) {
            return back()->with('error', 'Loan Category has staff loans and cannot be deleted');
        }

        $staffLoanCategory->delete();

        return back()->with('success', 'Loan Category Deleted successfully');
    }
}
