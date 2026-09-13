<?php

namespace App\Http\Requests\Customers;

use App\Models\Customer;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Step 1 of customer registration ("Basic information"), also used by the profile "Basic" tab.
 */
class BasicInformationRequest extends FormRequest
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
            'f_name' => ['required', 'string', 'max:100'],
            'm_name' => ['required', 'string', 'max:100'],
            'l_name' => ['required', 'string', 'max:100'],
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'empl_id' => ['required', Rule::exists('employees', 'id')->where('company_id', $companyId)],
            'gender' => ['required', 'in:male,female'],
            'date_birth' => ['required', 'date', 'before:today'],
            'phone_no' => ['required', 'numeric', 'digits_between:9,12'],
            'work_status' => ['required', Rule::in(array_keys(Customer::WORK_STATUSES))],
            'cust_type' => ['required', 'string', 'max:50'],
            'region_id' => ['required', 'exists:regions,id'],
            'district' => ['required', 'string', 'max:100'],
            'ward' => ['required', 'string', 'max:100'],
            'street' => ['required', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function customerData(): array
    {
        $dateOfBirth = CarbonImmutable::parse($this->input('date_birth'));

        return [
            'first_name' => $this->string('f_name')->trim()->toString(),
            'middle_name' => $this->string('m_name')->trim()->toString(),
            'last_name' => $this->string('l_name')->trim()->toString(),
            'branch_id' => $this->integer('blanch_id'),
            'employee_id' => $this->integer('empl_id'),
            'gender' => $this->string('gender')->toString(),
            'date_of_birth' => $dateOfBirth->toDateString(),
            'age' => now()->year - $dateOfBirth->year,
            'phone' => $this->normalisedPhone(),
            'work_status' => $this->string('work_status')->toString(),
            'customer_type' => $this->string('cust_type')->toString(),
            'region_id' => $this->integer('region_id'),
            'district' => $this->string('district')->trim()->toString(),
            'ward' => $this->string('ward')->trim()->toString(),
            'street' => $this->string('street')->trim()->toString(),
        ];
    }

    /**
     * Live stores numbers as 255XXXXXXXXX (e.g. input 0782828429 → 255782828429).
     */
    private function normalisedPhone(): string
    {
        $digits = preg_replace('/\D/', '', (string) $this->input('phone_no'));

        return match (true) {
            str_starts_with($digits, '255') => $digits,
            str_starts_with($digits, '0') => '255'.substr($digits, 1),
            default => '255'.$digits,
        };
    }
}
