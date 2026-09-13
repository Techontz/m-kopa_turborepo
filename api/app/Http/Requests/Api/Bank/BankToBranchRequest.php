<?php

namespace App\Http\Requests\Api\Bank;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Bank → Transfer Balance /Branch Acc.
 */
class BankToBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('bank.manage');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $companyId = $this->user()->company_id;

        return [
            'from_account' => ['required', Rule::exists('bank_accounts', 'id')->where('company_id', $companyId)],
            'to_blanch' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'amount' => ['required', 'numeric', 'min:1'],
            'charger_fee' => ['required', 'numeric', 'min:0'],
        ];
    }
}
