<?php

namespace App\Http\Requests\Api\Capital;

use App\Models\DividendDeclaration;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class DividendDeclarationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('profit_amount'))) {
            $this->merge(['profit_amount' => str_replace([',', ' '], '', $this->input('profit_amount'))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'period' => [
                'required', 'date_format:Y-m', 'before_or_equal:'.now()->format('Y-m'),
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $exists = DividendDeclaration::where('company_id', $this->user()->company_id)
                        ->whereDate('period', $value.'-01')
                        ->exists();
                    if ($exists) {
                        $fail('Dividend for this month is already declared.');
                    }
                },
            ],
            'profit_amount' => ['required', 'numeric', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['period.before_or_equal' => 'Dividend cannot be declared for a future month.'];
    }
}
