<?php

namespace App\Http\Controllers\Api\V1\Settings;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\LoanSubCategory;
use App\Models\MainCategory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;

/**
 * Settings → Main Loan Categories: one loan group per customer type (1:1, name derived from the customer type, no free-text
 * rename), with its loan category counts and enable / disable. Also the legacy live "Sub category Loan" rows
 * (LoanSubCategory, table customer_types) — kept for reference, used by no loan rule.
 */
class MainCategoryController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $categories = MainCategory::query()->listed($this->currentEmployee()->company_id)
            ->with('customerType')
            ->withCount([
                'loanCategories',
                'loanCategories as active_loan_categories_count' => fn (Builder $query) => $query->whereHas('branches'),
            ])
            ->get();

        return response()->json(['data' => $categories->map(fn (MainCategory $category): array => $this->present($category))]);
    }

    public function show(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $mainCategory->load('customerType')->loadCount([
            'loanCategories',
            'loanCategories as active_loan_categories_count' => fn (Builder $query) => $query->whereHas('branches'),
        ]);

        return response()->json(['data' => $this->present($mainCategory)]);
    }

    public function enable(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $mainCategory->update(['is_enabled' => true]);

        return $this->message('Main loan category enabled successfully');
    }

    public function disable(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $mainCategory->update(['is_enabled' => false]);

        return $this->message('Main loan category disabled successfully');
    }

    public function subCategories(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        return response()->json([
            'data' => [
                'main_category' => ['id' => $mainCategory->id, 'name' => $mainCategory->display_name],
                'sub_categories' => $mainCategory->subCategories()->orderBy('id')->get()->map(fn (LoanSubCategory $subCategory): array => [
                    'id' => $subCategory->id,
                    'code' => $subCategory->code,
                    'name' => $subCategory->name,
                    'is_enabled' => $subCategory->is_enabled,
                ]),
            ],
        ]);
    }

    public function enableSubCategory(LoanSubCategory $subCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $subCategory->update(['is_enabled' => true]);

        return $this->message('Sub Category Added successfully');
    }

    public function disableSubCategory(LoanSubCategory $subCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $subCategory->update(['is_enabled' => false]);

        return $this->message('Sub Category Deleted successfully');
    }

    /**
     * Active loan categories = the group is enabled and the category is assigned to at least one branch.
     *
     * @return array{id: int, code: string, name: string, customerType: array{id: int, code: string|null, name: string}|null, loanCategoriesCount: int, activeLoanCategoriesCount: int, isEnabled: bool, status: string}
     */
    private function present(MainCategory $category): array
    {
        return [
            'id' => $category->id,
            'code' => $category->code,
            'name' => $category->display_name,
            'customerType' => $category->customerType ? ['id' => $category->customerType->id, 'code' => $category->customerType->code, 'name' => $category->customerType->name] : null,
            'loanCategoriesCount' => (int) $category->loan_categories_count,
            'activeLoanCategoriesCount' => $category->is_enabled ? (int) $category->active_loan_categories_count : 0,
            'isEnabled' => (bool) $category->is_enabled,
            'status' => $category->is_enabled ? 'ENABLED' : 'DISABLED',
        ];
    }
}
