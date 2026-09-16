<?php

namespace App\Http\Requests\Api\Payments;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Branch / teller non-cash receipt (POST /payments/branch-receipts): Vodacom M-Pesa, Yas (Tigo), Airtel, HaloPesa or bank, with
 * the provider transaction ID (unique per channel). Cash keeps the teller cash + deposit slip flow.
 */
class BranchReceiptRequest extends FormRequest
{
    public const CHANNELS = ['VODACOM', 'TIGO', 'AIRTEL', 'HALOPESA', 'MPESA', 'BANK'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['channel' => strtoupper((string) $this->input('channel'))]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'loan_id' => ['required', 'integer', Rule::exists('loans', 'id')->where('company_id', $this->user()->company_id)],
            'amount' => ['required', 'numeric', 'min:1', 'max:9999999999999'],
            'channel' => ['required', 'string', Rule::in(self::CHANNELS)],
            'transaction_id' => ['required', 'string', 'max:100', Rule::unique('payments', 'transaction_id')->where('channel', (string) $this->input('channel'))],
            'bank_account_id' => ['nullable', 'integer', Rule::exists('bank_accounts', 'id')->where('company_id', $this->user()->company_id)],
            'reference' => ['nullable', 'string', 'max:100'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
