<?php

namespace App\Http\Controllers\Api\V1\Settings;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\CustomerType;
use App\Models\MainCategory;
use Illuminate\Http\JsonResponse;

/**
 * Settings → Main Loan Category (live admin/main_loan_category) and its legacy loan sub categories (table customer_types —
 * not the configured Customer Types, which live in customer_categories).
 */
class MainCategoryController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $categories = MainCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get();

        return response()->json(['data' => $categories->map(fn (MainCategory $category): array => [
            'id' => $category->id,
            'code' => $category->code,
            'name' => $category->name,
            'is_enabled' => $category->is_enabled,
        ])]);
    }

    public function enable(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $mainCategory->update(['is_enabled' => true]);

        return $this->message('Category Added successfully');
    }

    public function disable(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $mainCategory->update(['is_enabled' => false]);

        return $this->message('Category Deleted successfully');
    }

    public function types(MainCategory $mainCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        return response()->json([
            'data' => [
                'main_category' => ['id' => $mainCategory->id, 'name' => $mainCategory->name],
                'types' => $mainCategory->customerTypes()->orderBy('id')->get()->map(fn (CustomerType $type): array => [
                    'id' => $type->id,
                    'code' => $type->code,
                    'name' => $type->name,
                    'is_enabled' => $type->is_enabled,
                ]),
            ],
        ]);
    }

    public function enableType(CustomerType $customerType): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $customerType->update(['is_enabled' => true]);

        return $this->message('Sub Category Added successfully');
    }

    public function disableType(CustomerType $customerType): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $customerType->update(['is_enabled' => false]);

        return $this->message('Sub Category Deleted successfully');
    }
}
