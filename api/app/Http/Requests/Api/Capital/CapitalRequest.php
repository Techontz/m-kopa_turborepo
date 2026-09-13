<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live "Add Capital" form (admin/create_capital).
 */
class CapitalRequest extends FormRequest
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
            'share_id' => ['required', Rule::exists('share_holders', 'id')->where('company_id', $this->user()->company_id)],
            'amount' => ['required', 'numeric', 'min:1'],
            'pay_method' => ['required', 'in:CASH,BANK'],
            'recept' => ['nullable', 'string', 'max:50'],
            'chaque_no' => ['nullable', 'string', 'max:50'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['share_id' => 'share holder', 'pay_method' => 'pay method', 'recept' => 'receipt', 'chaque_no' => 'cheque number'];
    }
}
