<?php

namespace App\Http\Controllers\Api\V1\Settings;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Settings\CustomerCategoryRequest;
use App\Http\Resources\Api\V1\Settings\CustomerCategoryResource;
use App\Models\AuditLog;
use App\Models\CustomerCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Settings → Customer Categories (Documents: CUSTOMER REGISTRATION OVERVIEW "Category = Rule Engine").
 * Each category controls allowed loan products, loan limits, required documents and risk level; its dynamic
 * registration form (form_schema) is shown read-only.
 */
class CustomerCategoryController extends ApiController
{
    public function index(): AnonymousResourceCollection
    {
        $this->authorizeAny('settings.manage');

        return CustomerCategoryResource::collection(CustomerCategory::where('company_id', $this->currentEmployee()->company_id)
            ->with(['loanCategories' => fn ($query) => $query->orderBy('loan_categories.id')])
            ->orderBy('id')
            ->get());
    }

    public function show(CustomerCategory $customerCategory): CustomerCategoryResource
    {
        $this->authorizeAny('settings.manage');

        return new CustomerCategoryResource($customerCategory->load('loanCategories'));
    }

    public function update(CustomerCategoryRequest $request, CustomerCategory $customerCategory): JsonResponse
    {
        $this->authorizeAny('settings.manage');

        $before = $customerCategory->only(['name', 'risk_level', 'min_loan_amount', 'max_loan_amount', 'required_documents', 'is_active']) + [
            'loan_category_ids' => $customerCategory->loanCategories()->pluck('loan_categories.id')->all(),
        ];

        DB::transaction(function () use ($request, $customerCategory, $before): void {
            $customerCategory->update($request->categoryData());
            $customerCategory->loanCategories()->sync(array_map('intval', $request->input('loan_category_ids', [])));

            AuditLog::create([
                'company_id' => $customerCategory->company_id,
                'employee_id' => $this->currentEmployee()->id,
                'action' => 'CustomerCategory.rules_updated',
                'auditable_type' => $customerCategory->getMorphClass(),
                'auditable_id' => $customerCategory->id,
                'before' => $before,
                'after' => $request->categoryData() + ['loan_category_ids' => array_map('intval', $request->input('loan_category_ids', []))],
                'ip_address' => $request->ip(),
            ]);
        });

        return $this->message('Customer Category Updated successfully', 200, ['data' => new CustomerCategoryResource($customerCategory->load('loanCategories'))]);
    }
}
