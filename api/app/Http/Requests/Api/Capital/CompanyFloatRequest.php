<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live "Transfer Float Form" (admin/create_float): company account → branch principal.
 */
class CompanyFloatRequest extends FormRequest
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
        return [
            'blanch_amount' => ['required', 'numeric', 'min:1'],
            'blanch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('company_id', $this->user()->company_id)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['blanch_amount' => 'amount', 'blanch_id' => 'branch'];
    }
}
