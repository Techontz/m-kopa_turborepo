<?php

namespace App\Http\Controllers\Api\V1\SalaryAdvance;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\SalaryAdvance\SalaryAdvanceCategoryRequest;
use App\Http\Resources\Api\V1\SalaryAdvance\SalaryAdvanceCategoryResource;
use App\Models\SalaryAdvanceCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Salary Advance → Salary advance Category (live admin/perifelar_setting).
 */
class SalaryAdvanceCategoryController extends ApiController
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorizeAny('salary_advance.manage');

        return SalaryAdvanceCategoryResource::collection(
            SalaryAdvanceCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get()
        );
    }

    public function store(SalaryAdvanceCategoryRequest $request): JsonResponse
    {
        $this->authorizeAny('salary_advance.manage');

        $category = SalaryAdvanceCategory::create($request->categoryData() + ['company_id' => $this->currentEmployee()->company_id]);

        return $this->message('Salary advance Category Registered successfully', 201, ['data' => new SalaryAdvanceCategoryResource($category)]);
    }

    public function update(SalaryAdvanceCategoryRequest $request, SalaryAdvanceCategory $salaryAdvanceCategory): JsonResponse
    {
        $this->authorizeAny('salary_advance.manage');

        $salaryAdvanceCategory->update($request->categoryData());

        return $this->message('Salary advance Category Updated successfully', 200, ['data' => new SalaryAdvanceCategoryResource($salaryAdvanceCategory)]);
    }

    public function destroy(SalaryAdvanceCategory $salaryAdvanceCategory): JsonResponse
    {
        $this->authorizeAny('salary_advance.manage');

        if ($salaryAdvanceCategory->salaryAdvances()->exists()) {
            return $this->message('Category has salary advance loans and cannot be deleted', 422);
        }

        $salaryAdvanceCategory->delete();

        return $this->message('Salary advance Category Deleted successfully');
    }
}
