<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Hrm\StaffSalaryAdvanceCategoryRequest;
use App\Models\StaffSalaryAdvance;
use App\Models\StaffSalaryAdvanceCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class StaffSalaryAdvanceCategoryController extends Controller
{
    public function index(): View
    {
        return view('hrm.staff-salary-advance-categories', [
            'categories' => StaffSalaryAdvanceCategory::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(StaffSalaryAdvanceCategoryRequest $request): RedirectResponse
    {
        StaffSalaryAdvanceCategory::create($request->categoryData() + ['company_id' => $this->employee()->company_id]);

        return back()->with('success', 'Category Saved successfully');
    }

    public function update(StaffSalaryAdvanceCategoryRequest $request, StaffSalaryAdvanceCategory $staffSalaryAdvanceCategory): RedirectResponse
    {
        $staffSalaryAdvanceCategory->update($request->categoryData());

        return back()->with('success', 'Category Updated successfully');
    }

    public function destroy(StaffSalaryAdvanceCategory $staffSalaryAdvanceCategory): RedirectResponse
    {
        if (StaffSalaryAdvance::where('staff_salary_advance_category_id', $staffSalaryAdvanceCategory->id)->exists()) {
            return back()->with('error', 'Category has salary advances and cannot be deleted');
        }

        $staffSalaryAdvanceCategory->delete();

        return back()->with('success', 'Category Deleted successfully');
    }
}
