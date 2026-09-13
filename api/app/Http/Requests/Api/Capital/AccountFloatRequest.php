<?php

namespace App\Http\Requests\Api\Capital;

use App\Enums\Account;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live "Transifor Float From Ac-Ac" form (admin/transfor_float_acc_acc): PRINCIPAL ↔ INTEREST within a branch.
 */
class AccountFloatRequest extends FormRequest
{
    /**
     * Live "PR" / "INT" option values.
     *
     * @var array<string, Account>
     */
    public const ACCOUNTS = ['PR' => Account::Principal, 'INT' => Account::Interest];

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
            'blanch_id' => ['required', 'integer', Rule::exists('branches', 'id')->where('company_id', $this->user()->company_id)],
            'from_acc' => ['required', Rule::in(array_keys(self::ACCOUNTS))],
            'to_acc' => ['required', 'different:from_acc', Rule::in(array_keys(self::ACCOUNTS))],
            'amount' => ['required', 'numeric', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['to_acc.different' => 'You cannot transfer float to the same account'];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['blanch_id' => 'branch', 'from_acc' => 'from account', 'to_acc' => 'to account'];
    }

    public function fromAccount(): Account
    {
        return self::ACCOUNTS[$this->string('from_acc')->toString()];
    }

    public function toAccount(): Account
    {
        return self::ACCOUNTS[$this->string('to_acc')->toString()];
    }
}
