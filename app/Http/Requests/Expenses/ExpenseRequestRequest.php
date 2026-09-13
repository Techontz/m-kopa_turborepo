<?php

namespace App\Http\Requests\Expenses;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Expense requisitions from the three live forms; field names follow each live form.
 */
class ExpenseRequestRequest extends FormRequest
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
        $companyId = $this->user()->company_id;
        $scope = $this->input('scope');
        $expenseType = fn (string $scope) => Rule::exists('expense_types', 'id')->where('company_id', $companyId)->where('scope', $scope);

        return match ($scope) {
            'bank' => [
                'scope' => ['required'],
                'ac_id' => ['required', Rule::exists('bank_accounts', 'id')->where('company_id', $companyId)],
                'exp_id' => ['required', $expenseType('bank')],
                'amount' => ['required', 'numeric', 'min:1'],
                'comment' => ['required', 'string', 'max:1000'],
            ],
            'hq' => [
                'scope' => ['required'],
                'ex_id' => ['required', $expenseType('hq')],
                'req_amount' => ['required', 'numeric', 'min:1'],
                'req_description' => ['required', 'string', 'max:1000'],
            ],
            default => [
                'scope' => ['required', Rule::in(['branch', 'hq', 'bank'])],
                'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
                'ex_id' => ['required', $expenseType('branch')],
                'req_amount' => ['required', 'numeric', 'min:1'],
                'req_description' => ['required', 'string', 'max:1000'],
            ],
        };
    }

    /**
     * @return array{scope: string, branch_id: int|null, bank_account_id: int|null, expense_type_id: int, amount: float, description: string|null, comment: string|null}
     */
    public function requestData(): array
    {
        $scope = $this->string('scope')->toString();

        if ($scope === 'bank') {
            return [
                'scope' => $scope,
                'branch_id' => null,
                'bank_account_id' => $this->integer('ac_id'),
                'expense_type_id' => $this->integer('exp_id'),
                'amount' => $this->float('amount'),
                'description' => null,
                'comment' => $this->string('comment')->toString(),
            ];
        }

        return [
            'scope' => $scope,
            'branch_id' => $scope === 'branch' ? $this->integer('blanch_id') : null,
            'bank_account_id' => null,
            'expense_type_id' => $this->integer('ex_id'),
            'amount' => $this->float('req_amount'),
            'description' => $this->string('req_description')->toString(),
            'comment' => null,
        ];
    }
}
