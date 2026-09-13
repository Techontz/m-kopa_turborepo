<?php

namespace App\Http\Requests\Api\Hq;

use App\Enums\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Headquater Transaction → Requested Transaction (move money between HQ accounts).
 */
class HqTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('hq.manage');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $hqAccounts = array_map(fn (Account $account): string => $account->value, Account::hqAccounts());

        return [
            'from_account' => ['required', Rule::in($hqAccounts)],
            'to_account' => ['required', Rule::in($hqAccounts), 'different:from_account'],
            'amount' => ['required', 'numeric', 'min:1'],
            'charge' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
