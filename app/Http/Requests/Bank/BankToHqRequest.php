<?php

namespace App\Http\Requests\Bank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BankToHqRequest extends FormRequest
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
            'from_acc' => ['required', Rule::exists('bank_accounts', 'id')->where('company_id', $this->user()->company_id)],
            'amount' => ['required', 'numeric', 'min:1'],
            'to_acc' => ['required', Rule::in(['salary', 'disbursement'])],
            'charger_fee' => ['required', 'numeric', 'min:0'],
        ];
    }
}
