<?php

namespace App\Http\Requests\Api\Settings;

use App\Http\Requests\Settings\LoanCategoryRequest as BaseLoanCategoryRequest;
use App\Models\InterestFormula;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * Live loan category form plus the Documents additions: requires_mandate (E-MANDATE vs NORMAL flow),
 * the customer types allowed to borrow the product and Freeze Time (Days) — the re-borrowing freeze.
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
            'freeze_time_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'customer_category_ids' => ['nullable', 'array'],
            'customer_category_ids.*' => ['integer', Rule::exists('customer_categories', 'id')->where('company_id', $this->user()->company_id)],
        ]);
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['customer_category_ids.*' => 'customer type', 'freeze_time_days' => 'freeze time (days)'];
    }

    /**
     * Freeze Time (Days) is kept when omitted; a new category without it takes the company default (Settings → Penalty).
     *
     * @return array<string, mixed>
     */
    public function categoryData(): array
    {
        return parent::categoryData()
            + ['requires_mandate' => $this->input('requires_mandate') === 'YES']
            + ($this->filled('freeze_time_days') ? ['freeze_time_days' => $this->integer('freeze_time_days')] : []);
    }

    /**
     * @return list<int>
     */
    public function customerCategoryIds(): array
    {
        return array_map('intval', $this->input('customer_category_ids', []));
    }
}
