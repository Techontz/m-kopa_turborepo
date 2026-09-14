<?php

namespace App\Http\Controllers\Api\V1\Settings;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Settings\LoanCategoryRequest;
use App\Http\Resources\Api\V1\Settings\LoanCategoryResource;
use App\Models\Branch;
use App\Models\LoanCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Settings → Loan Category (live admin/loan_category, edit_loan_category, loan_category_blanch), extended with the
 * Documents' requires_mandate flag and Freeze Time. Each loan category belongs to one main loan category, i.e. one customer type.
 */
class LoanCategoryController extends ApiController
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAny('settings.manage');

        $categories = LoanCategory::where('company_id', $this->currentEmployee()->company_id)
            ->when($request->filled('main_category_id'), fn ($query) => $query->where('main_category_id', $request->integer('main_category_id')))
            ->with(['mainCategory.customerType', 'branches' => fn ($query) => $query->orderBy('branches.id')])
            ->orderBy('main_category_id')
            ->orderBy('id')
            ->get();

        return LoanCategoryResource::collection($categories);
    }

    public function store(LoanCategoryRequest $request): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $company = $this->currentEmployee()->company;
        $category = LoanCategory::create($request->categoryData() + [
            'company_id' => $company->id,
            'freeze_time_days' => (int) $company->loan_freeze_days,
        ]);

        return $this->message('Loan Category Registered successfully', 201, ['data' => new LoanCategoryResource($category->load('mainCategory.customerType'))]);
    }

    public function show(LoanCategory $loanCategory): LoanCategoryResource
    {
        $this->authorizeAny('settings.manage');

        return new LoanCategoryResource($loanCategory->load(['mainCategory.customerType', 'branches' => fn ($query) => $query->orderBy('branches.id')]));
    }

    public function update(LoanCategoryRequest $request, LoanCategory $loanCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $loanCategory->update($request->categoryData());

        return $this->message('Loan Category Updated successfully', 200, ['data' => new LoanCategoryResource($loanCategory->load('mainCategory.customerType'))]);
    }

    public function destroy(LoanCategory $loanCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        if ($loanCategory->loans()->exists()) {
            return $this->message('Loan Category has loans and cannot be deleted', 422);
        }

        $loanCategory->delete();

        return $this->message('Loan Category Deleted successfully');
    }

    public function attachBranch(LoanCategory $loanCategory, Branch $branch): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $loanCategory->branches()->syncWithoutDetaching([$branch->id]);

        return $this->message('Branch Added successfully');
    }

    public function detachBranch(LoanCategory $loanCategory, Branch $branch): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $loanCategory->branches()->detach($branch->id);

        return $this->message('Branch Removed successfully');
    }
}
