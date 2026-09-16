<?php

namespace App\Http\Requests\Api\Hq;

use App\Enums\Account;
use App\Services\Approvals\ReserveProtection;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Headquarters Transaction → Requested Transaction (move money between HQ accounts).
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
            'from_account' => [
                'required',
                Rule::in($hqAccounts),
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (ReserveProtection::isReserve(is_string($value) ? $value : null)) {
                        $fail(ReserveProtection::MESSAGE);
                    }
                },
            ],
            'to_account' => ['required', Rule::in($hqAccounts), 'different:from_account'],
            'amount' => ['required', 'numeric', 'min:1'],
            'charge' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
