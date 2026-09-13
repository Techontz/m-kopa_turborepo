<?php

namespace App\Http\Requests\Customers;

use App\Models\Customer;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Step 2 of customer registration ("Aditinal Detail").
 */
class AdditionalDetailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['month_income' => preg_replace('/[^\d.]/', '', (string) $this->input('month_income'))]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'famous_area' => ['required', 'string', 'max:100'],
            'martial_status' => ['required', Rule::in(Customer::MARITAL_STATUSES)],
            'account_id' => ['required'],
            'bussiness_type' => ['required', 'string', 'max:100'],
            'place_imployment' => ['required', 'string', 'max:150'],
            'number_dependents' => ['required', 'integer', 'min:0', 'max:50'],
            'month_income' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function customerData(): array
    {
        return [
            'nickname' => $this->string('famous_area')->trim()->toString(),
            'marital_status' => $this->string('martial_status')->toString(),
            'account_type' => 'LOAN ACCOUNT',
            'business_type' => $this->string('bussiness_type')->trim()->toString(),
            'place_of_business' => $this->string('place_imployment')->trim()->toString(),
            'dependents' => $this->integer('number_dependents'),
            'monthly_income' => $this->filled('month_income') ? (float) $this->input('month_income') : null,
        ];
    }
}
