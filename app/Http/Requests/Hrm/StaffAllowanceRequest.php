<?php

namespace App\Http\Requests\Hrm;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * "Staff Allowance Form".
 */
class StaffAllowanceRequest extends FormRequest
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

        return [
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'empl_id' => ['required', Rule::exists('employees', 'id')->where('company_id', $companyId)->where('branch_id', $this->integer('blanch_id'))],
            'new_amount' => ['required', 'numeric', 'min:1'],
            'remaks_allow' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function allowanceData(): array
    {
        return [
            'branch_id' => $this->integer('blanch_id'),
            'employee_id' => $this->integer('empl_id'),
            'amount' => (float) $this->input('new_amount'),
            'description' => $this->input('remaks_allow'),
        ];
    }
}
