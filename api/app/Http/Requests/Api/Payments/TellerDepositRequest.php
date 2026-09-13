<?php

namespace App\Http\Requests\Api\Payments;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Teller "Deposit" modal (live admin/deposit_loan): depost, p_method, recept.
 */
class TellerDepositRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['depost' => preg_replace('/[^\d.]/', '', (string) $this->input('depost'))]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'depost' => ['required', 'numeric', 'min:1'],
            'p_method' => ['required', 'string', 'in:CASH'],
            'recept' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['depost.required' => 'Enter Deposit Amount'];
    }
}
