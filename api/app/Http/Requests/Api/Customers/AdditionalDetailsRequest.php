<?php

namespace App\Http\Requests\Api\Customers;

use App\Models\Customer;
use App\Models\CustomerResidence;
use App\Services\Customers\TanzaniaLocations;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Additional customer data added by the officer after NIDA (Documents §3): bank details, marital status,
 * current residence selected from the system lists, next of kin; plus the live "Aditinal Detail" fields.
 */
class AdditionalDetailsRequest extends FormRequest
{
    /** Documents marital status options (live values stay accepted for older records). */
    public const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('month_income')) {
            $this->merge(['month_income' => preg_replace('/[^\d.]/', '', (string) $this->input('month_income'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $locations = app(TanzaniaLocations::class);

        return [
            'martial_status' => ['required', Rule::in([...self::MARITAL_STATUSES, ...Customer::MARITAL_STATUSES])],

            'region_code' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail) use ($locations): void {
                if ($locations->regionName((string) $value) === null) {
                    $fail('The selected Mkoa is invalid.');
                }
            }],
            'district_code' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail) use ($locations): void {
                if ($locations->districtName((string) $this->input('region_code'), (string) $value) === null) {
                    $fail('The selected Wilaya is invalid.');
                }
            }],
            'ward_code' => ['required', 'string', function (string $attribute, mixed $value, Closure $fail) use ($locations): void {
                if ($locations->wardName((string) $this->input('district_code'), (string) $value) === null) {
                    $fail('The selected Kata is invalid.');
                }
            }],
            'street_name' => ['required', 'string', 'max:100'],
            'residence_type' => ['required', Rule::in(array_keys(CustomerResidence::OWNERSHIP))],

            'bank_name' => ['required', 'string', 'max:100'],
            'account_number' => ['required', 'string', 'max:50'],
            'account_name' => ['required', 'string', 'max:150'],
            'check_number' => ['nullable', 'string', 'max:50'],
            'bank_phone' => ['nullable', 'numeric', 'digits_between:9,12'],

            'kin_first_name' => ['required', 'string', 'max:100'],
            'kin_middle_name' => ['nullable', 'string', 'max:100'],
            'kin_last_name' => ['required', 'string', 'max:100'],
            'kin_phone' => ['required', 'numeric', 'digits_between:9,12'],
            'kin_relationship' => ['nullable', 'string', 'max:50'],

            'famous_area' => ['nullable', 'string', 'max:100'],
            'bussiness_type' => ['nullable', 'string', 'max:100'],
            'place_imployment' => ['nullable', 'string', 'max:150'],
            'number_dependents' => ['nullable', 'integer', 'min:0', 'max:50'],
            'month_income' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'martial_status' => 'marital status',
            'street_name' => 'Mtaa',
            'residence_type' => 'Makazi',
            'kin_first_name' => 'next of kin first name',
            'kin_last_name' => 'next of kin last name',
            'kin_phone' => 'next of kin phone',
        ];
    }

    public static function normalisePhone(?string $phone): ?string
    {
        if ($phone === null || $phone === '') {
            return null;
        }

        $digits = preg_replace('/\D/', '', $phone);

        return match (true) {
            str_starts_with($digits, '255') => $digits,
            str_starts_with($digits, '0') => '255'.substr($digits, 1),
            default => '255'.$digits,
        };
    }
}
