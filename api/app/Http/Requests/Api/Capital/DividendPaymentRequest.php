<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Dividend withdrawal: the handwritten note gives the Dividend (Gawio) account two ways of withdrawing — CASH or BANK.
 */
class DividendPaymentRequest extends FormRequest
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
            'pay_method' => ['required', 'in:CASH,BANK'],
            'bank_account_id' => ['required_if:pay_method,BANK', 'nullable', 'integer', Rule::exists('bank_accounts', 'id')->where('company_id', $this->user()->company_id)],
            'reference' => ['nullable', 'string', 'max:50'],
        ];
    }
}
