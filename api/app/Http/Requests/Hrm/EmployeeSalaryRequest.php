<?php

namespace App\Http\Requests\Hrm;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * "Add Sallary Information" modal on the employee profile (Salary tab).
 */
class EmployeeSalaryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'salary' => str_replace(',', '', (string) $this->input('salary')),
            'fee_salary' => str_replace(',', '', (string) $this->input('fee_salary')),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'salary' => ['required', 'numeric', 'min:0'],
            'account_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'fee_salary' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array{salary: float, account_name: string, account_number: string, fee: float}
     */
    public function salaryData(): array
    {
        return [
            'salary' => (float) $this->input('salary'),
            'account_name' => $this->string('account_name')->trim()->toString(),
            'account_number' => $this->string('account_number')->trim()->toString(),
            'fee' => (float) $this->input('fee_salary'),
        ];
    }
}
