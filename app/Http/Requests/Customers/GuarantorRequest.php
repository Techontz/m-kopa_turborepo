<?php

namespace App\Http\Requests\Customers;

use App\Models\Customer;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GuarantorRequest extends FormRequest
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
        return [
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'numeric', 'digits_between:9,12'],
            'gender' => ['nullable', 'in:male,female'],
            'marital_status' => ['nullable', Rule::in(Customer::MARITAL_STATUSES)],
            'id_number' => ['nullable', 'string', 'max:50'],
            'relationship' => ['required', 'string', 'max:50'],
            'region_id' => ['nullable', 'exists:regions,id'],
            'district' => ['nullable', 'string', 'max:100'],
            'ward' => ['nullable', 'string', 'max:100'],
            'street' => ['nullable', 'string', 'max:100'],
        ];
    }
}
