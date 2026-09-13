<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live "Transfar float" modal (admin/transfor_float): branch → branch request.
 */
class BranchFloatRequest extends FormRequest
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
        $branch = Rule::exists('branches', 'id')->where('company_id', $this->user()->company_id);

        return [
            'from_blanch_id' => ['required', 'integer', $branch],
            'to_blanch_id' => ['required', 'integer', 'different:from_blanch_id', $branch],
            'trans_amount' => ['required', 'numeric', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['to_blanch_id.different' => 'You cannot transfer float to the same branch'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['from_blanch_id' => 'from branch', 'to_blanch_id' => 'to branch', 'trans_amount' => 'amount'];
    }
}
