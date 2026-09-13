<?php

namespace App\Http\Requests\Api\Settings;

use App\Http\Requests\Settings\LoanCategoryRequest as BaseLoanCategoryRequest;
use App\Models\InterestFormula;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Live loan category form plus the Documents additions: requires_mandate (E-MANDATE vs NORMAL flow)
 * and the customer categories allowed to borrow the product.
 */
class LoanCategoryRequest extends BaseLoanCategoryRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'formular' => ['required', Rule::in(InterestFormula::where('is_enabled', true)->pluck('code')->all())],
            'requires_mandate' => ['required', 'in:YES,NO'],
            'customer_category_ids' => ['nullable', 'array'],
            'customer_category_ids.*' => ['integer', Rule::exists('customer_categories', 'id')->where('company_id', $this->user()->company_id)],
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['customer_category_ids.*' => 'customer category'];
    }

    /**
     * @return array<string, mixed>
     */
    public function categoryData(): array
    {
        return parent::categoryData() + ['requires_mandate' => $this->input('requires_mandate') === 'YES'];
    }

    /**
     * @return list<int>
     */
    public function customerCategoryIds(): array
    {
        return array_map('intval', $this->input('customer_category_ids', []));
    }
}
