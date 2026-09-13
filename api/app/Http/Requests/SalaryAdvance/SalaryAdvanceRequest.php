<?php

namespace App\Http\Requests\SalaryAdvance;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SalaryAdvanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $companyId = $this->user()->company_id;

        return [
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'customer_id' => ['required', Rule::exists('customers', 'id')->where('company_id', $companyId)->where('branch_id', $this->integer('blanch_id'))],
            'per_id' => ['required', Rule::exists('salary_advance_categories', 'id')->where('company_id', $companyId)],
            'loan_amount' => ['required', 'numeric', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'blanch_id.required' => 'Please select branch',
            'customer_id.required' => 'Please select customer',
            'per_id.required' => 'Please select category',
            'loan_amount.required' => 'Please enter loan amount',
        ];
    }
}
