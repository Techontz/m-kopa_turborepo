<?php

namespace App\Http\Requests\Api\Bank;

use App\Enums\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Bank → Bank Transaction modal "Transfer Amount From Branch To Bank".
 */
class BranchToBankRequest extends FormRequest
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
            'from_blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'ac_type' => ['required', Rule::in(array_map(fn (Account $account): string => $account->value, Account::transferableBranchAccounts()))],
            'amount' => ['required', 'numeric', 'min:1'],
            'to_account_id' => ['required', Rule::exists('bank_accounts', 'id')->where('company_id', $companyId)],
        ];
    }
}
