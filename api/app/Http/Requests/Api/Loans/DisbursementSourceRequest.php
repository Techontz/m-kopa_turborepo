<?php

namespace App\Http\Requests\Api\Loans;

use App\Models\LoanDisbursement;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Disbursement source chosen by Finance: "cash" (the loan branch's PRINCIPAL A/C) or "bank" with a company bank
 * account. Optional: without it a new batch keeps the previous batch's source (branch cash for the first batch).
 */
class DisbursementSourceRequest extends FormRequest
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
        return self::sourceRules($this->user()->company_id);
    }

    /**
     * @return array<string, array<mixed>>
     */
    public static function sourceRules(int $companyId): array
    {
        return [
            'source_account' => ['nullable', Rule::in([LoanDisbursement::SOURCE_CASH, LoanDisbursement::SOURCE_BANK])],
            'source_bank_account_id' => ['nullable', 'required_if:source_account,'.LoanDisbursement::SOURCE_BANK, Rule::exists('bank_accounts', 'id')->where('company_id', $companyId)],
        ];
    }

    /**
     * @return array{source_account: string|null, source_bank_account_id: int|null}|null
     */
    public function source(): ?array
    {
        return $this->filled('source_account')
            ? ['source_account' => $this->string('source_account')->toString(), 'source_bank_account_id' => $this->filled('source_bank_account_id') ? $this->integer('source_bank_account_id') : null]
            : null;
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['source_account' => 'disbursement source', 'source_bank_account_id' => 'source bank account'];
    }
}
