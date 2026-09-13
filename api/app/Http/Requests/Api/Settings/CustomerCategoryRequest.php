<?php

namespace App\Http\Requests\Api\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Customer category rule engine (Documents: CUSTOMER REGISTRATION OVERVIEW — loan type, loan limits,
 * required documents, risk level). The dynamic form schema is fixed per category and not editable here.
 */
class CustomerCategoryRequest extends FormRequest
{
    /**
     * @var list<string>
     */
    public const RISK_LEVELS = ['low', 'medium', 'high'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(collect(['min_loan_amount', 'max_loan_amount'])
            ->filter(fn (string $field): bool => is_string($this->input($field)))
            ->mapWithKeys(fn (string $field): array => [$field => str_replace([',', ' '], '', $this->input($field))])
            ->all());

        if (is_array($this->input('required_documents'))) {
            $this->merge(['required_documents' => array_values(array_filter(array_map(
                fn ($document): string => trim((string) $document),
                $this->input('required_documents'),
            ), fn (string $document): bool => $document !== ''))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'risk_level' => ['required', Rule::in(self::RISK_LEVELS)],
            'min_loan_amount' => ['required', 'numeric', 'min:0'],
            'max_loan_amount' => ['required', 'numeric', 'gte:min_loan_amount'],
            'required_documents' => ['present', 'array'],
            'required_documents.*' => ['string', 'max:255', 'distinct'],
            'loan_category_ids' => ['present', 'array'],
            'loan_category_ids.*' => ['integer', Rule::exists('loan_categories', 'id')->where('company_id', $this->user()->company_id)],
            'is_active' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['loan_category_ids.*' => 'loan product', 'required_documents.*' => 'document'];
    }

    /**
     * @return array<string, mixed>
     */
    public function categoryData(): array
    {
        return [
            'name' => $this->string('name')->trim()->toString(),
            'risk_level' => $this->string('risk_level')->toString(),
            'min_loan_amount' => $this->float('min_loan_amount'),
            'max_loan_amount' => $this->float('max_loan_amount'),
            'required_documents' => $this->input('required_documents', []),
            'is_active' => $this->boolean('is_active'),
        ];
    }
}
