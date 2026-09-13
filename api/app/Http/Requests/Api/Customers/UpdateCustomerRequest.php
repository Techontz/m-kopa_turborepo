<?php

namespace App\Http\Requests\Api\Customers;

use App\Models\Customer;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Profile "Basic" tab (live update_customer_info). For NIDA-verified customers the NIDA fields
 * (names, gender, date of birth, phone, NIDA number) are never editable: only branch and loan officer are.
 */
class UpdateCustomerRequest extends FormRequest
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
        $rules = [
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'empl_id' => ['required', Rule::exists('employees', 'id')->where('company_id', $companyId)],
        ];

        if ($this->isNidaVerified()) {
            return $rules;
        }

        return $rules + [
            'f_name' => ['required', 'string', 'max:100'],
            'm_name' => ['required', 'string', 'max:100'],
            'l_name' => ['required', 'string', 'max:100'],
            'gender' => ['required', 'in:male,female'],
            'date_birth' => ['required', 'date', 'before:today'],
            'phone_no' => ['required', 'numeric', 'digits_between:9,12'],
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
        $data = [
            'branch_id' => $this->integer('blanch_id'),
            'employee_id' => $this->integer('empl_id'),
        ];

        if ($this->isNidaVerified()) {
            return $data;
        }

        $dateOfBirth = CarbonImmutable::parse($this->input('date_birth'));

        return $data + [
            'first_name' => $this->string('f_name')->trim()->toString(),
            'middle_name' => $this->string('m_name')->trim()->toString(),
            'last_name' => $this->string('l_name')->trim()->toString(),
            'gender' => $this->string('gender')->toString(),
            'date_of_birth' => $dateOfBirth->toDateString(),
            'age' => now()->year - $dateOfBirth->year,
            'phone' => AdditionalDetailsRequest::normalisePhone($this->string('phone_no')->toString()),
            'region_id' => $this->integer('region_id'),
            'district' => $this->string('district')->trim()->toString(),
            'ward' => $this->string('ward')->trim()->toString(),
            'street' => $this->string('street')->trim()->toString(),
        ];
    }

    private function isNidaVerified(): bool
    {
        /** @var Customer $customer */
        $customer = $this->route('customer');

        return $customer->kyc()->exists();
    }
}
