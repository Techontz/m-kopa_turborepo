<?php

namespace App\Http\Requests\Hrm;

use App\Models\Employee;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Register Employee" modal (Employee List) and the profile "Basic" tab.
 */
class EmployeeRequest extends FormRequest
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
        /** @var Employee|null $employee */
        $employee = $this->route('employee');

        return [
            'empl_name' => ['required', 'string', 'max:100'],
            'emp_mname' => ['required', 'string', 'max:100'],
            'emp_lname' => ['required', 'string', 'max:100'],
            'empl_no' => ['required', 'string', 'max:20', Rule::unique('employees', 'phone')->ignore($employee?->id)],
            'date_birth' => ['required', 'date', 'before:today'],
            'empl_email' => ['required', 'email', 'max:150'],
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $this->user()->company_id)],
            'position_id' => ['required', Rule::in(array_keys(Employee::POSITIONS))],
            'username' => ['nullable', 'string', 'max:100'],
            'empl_sex' => ['nullable', Rule::in(['Male', 'Female'])],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function employeeData(): array
    {
        return [
            'first_name' => $this->string('empl_name')->trim()->toString(),
            'middle_name' => $this->string('emp_mname')->trim()->toString(),
            'last_name' => $this->string('emp_lname')->trim()->toString(),
            'phone' => $this->string('empl_no')->trim()->toString(),
            'date_of_birth' => $this->date('date_birth'),
            'email' => $this->string('empl_email')->trim()->toString(),
            'branch_id' => $this->integer('blanch_id'),
            'position' => $this->string('position_id')->toString(),
            'username' => $this->filled('username') ? $this->string('username')->trim()->toString() : null,
            'gender' => $this->filled('empl_sex') ? strtolower($this->string('empl_sex')->toString()) : null,
        ];
    }
}
