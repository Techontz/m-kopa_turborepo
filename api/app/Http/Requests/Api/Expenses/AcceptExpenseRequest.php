<?php

namespace App\Http\Requests\Api\Expenses;

use App\Enums\Account;
use App\Services\ExpenseApproval;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Expenses Accept Comment" modal; from_account applies to HQ expenses only (HQ accounts, never branch interest).
 */
class AcceptExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('expenses.approve_branch') || $this->user()->can('expenses.approve_hq');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'req_comment' => ['nullable', 'string', 'max:1000'],
            'req_amount' => ['nullable', 'numeric', 'min:1'],
            'from_account' => ['nullable', Rule::in(array_map(fn (Account $account): string => $account->value, ExpenseApproval::hqSourceAccounts()))],
        ];
    }
}
