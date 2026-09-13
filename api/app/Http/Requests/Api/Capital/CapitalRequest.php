<?php

namespace App\Http\Requests\Api\Capital;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live "Add Capital" form (admin/create_capital), plus the uploaded receipt file ("Import Receipt").
 * `recept` is the typed receipt number; `receipt_file` is the scanned receipt (PDF or image).
 */
class CapitalRequest extends FormRequest
{
    public const RECEIPT_MIMES = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    public const RECEIPT_MAX_KB = 5120;

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
            'share_id' => ['required', Rule::exists('share_holders', 'id')->where('company_id', $this->user()->company_id)],
            'amount' => ['required', 'numeric', 'min:1'],
            'pay_method' => ['required', 'in:CASH,BANK'],
            'recept' => ['nullable', 'string', 'max:50'],
            'chaque_no' => ['nullable', 'string', 'max:50'],
            'receipt_file' => ['nullable', 'file', 'mimes:'.implode(',', self::RECEIPT_MIMES), 'max:'.self::RECEIPT_MAX_KB],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['share_id' => 'share holder', 'pay_method' => 'pay method', 'recept' => 'receipt', 'chaque_no' => 'cheque number', 'receipt_file' => 'import receipt'];
    }
}
