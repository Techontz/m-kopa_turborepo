<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\CustomerType;
use App\Models\MainCategory;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class MainCategoryController extends Controller
{
    public function index(): View
    {
        $categories = MainCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get();

        return view('settings.main-categories', [
            'categories' => $categories,
            'enabledCategories' => $categories->where('is_enabled', true)->values(),
        ]);
    }

    public function enable(MainCategory $mainCategory): RedirectResponse
    {
        $mainCategory->update(['is_enabled' => true]);

        return back()->with('success', 'Category Added successfully');
    }

    public function disable(MainCategory $mainCategory): RedirectResponse
    {
        $mainCategory->update(['is_enabled' => false]);

        return back()->with('success', 'Category Deleted successfully');
    }

    public function types(MainCategory $mainCategory): View
    {
        $types = $mainCategory->customerTypes()->orderBy('id')->get();

        return view('settings.customer-types', [
            'mainCategory' => $mainCategory,
            'types' => $types,
            'enabledTypes' => $types->where('is_enabled', true)->values(),
        ]);
    }

    public function enableType(CustomerType $customerType): RedirectResponse
    {
        $customerType->update(['is_enabled' => true]);

        return back()->with('success', 'Sub Category Added successfully');
    }

    public function disableType(CustomerType $customerType): RedirectResponse
    {
        $customerType->update(['is_enabled' => false]);

        return back()->with('success', 'Sub Category Deleted successfully');
    }
}
