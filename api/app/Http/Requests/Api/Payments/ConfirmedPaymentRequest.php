<?php

namespace App\Http\Requests\Api\Payments;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Finance-entered payment, single step (POST /payments/confirmed): the loan, amount, channel, optional bank account (else the
 * bank clearing account), reference, transaction ID (unique per channel) and date.
 */
class ConfirmedPaymentRequest extends FormRequest
{
    public const CHANNELS = ['CASH', 'BANK', 'VODACOM', 'AIRTEL', 'TIGO', 'HALOPESA', 'MPESA', 'OTHER'];

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
            'loan_id' => ['required', 'integer', Rule::exists('loans', 'id')->where('company_id', $this->user()->company_id)],
            'amount' => ['required', 'numeric', 'min:1', 'max:9999999999999'],
            'channel' => ['required', 'string', Rule::in(self::CHANNELS)],
            'bank_account_id' => ['nullable', 'integer', Rule::exists('bank_accounts', 'id')->where('company_id', $this->user()->company_id)],
            'reference' => ['nullable', 'string', 'max:100'],
            'transaction_id' => ['nullable', 'string', 'max:100', Rule::unique('payments', 'transaction_id')->where('channel', strtoupper((string) $this->input('channel')))],
            'paid_on' => ['required', 'date', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
