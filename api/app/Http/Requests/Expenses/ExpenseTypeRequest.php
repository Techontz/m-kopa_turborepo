<?php

namespace App\Http\Requests\Expenses;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseTypeRequest extends FormRequest
{
    /**
     * Live input name of the expense name field on each page.
     *
     * @var array<string, string>
     */
    public const NAME_FIELDS = [
        'branch' => 'ex_name',
        'hq' => 'exp_desc',
        'bank' => 'expenses_name',
    ];

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
            'scope' => ['required', Rule::in(array_keys(self::NAME_FIELDS))],
            $this->nameField() => ['required', 'string', 'max:255'],
        ];
    }

    public function scope(): string
    {
        return $this->string('scope')->toString();
    }

    public function expenseName(): string
    {
        return $this->string($this->nameField())->toString();
    }

    private function nameField(): string
    {
        return self::NAME_FIELDS[$this->input('scope')] ?? 'ex_name';
    }
}
