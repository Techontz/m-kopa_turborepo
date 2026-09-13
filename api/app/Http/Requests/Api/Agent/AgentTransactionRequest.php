<?php

namespace App\Http\Requests\Api\Agent;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Live admin/create_miamala fields.
 */
class AgentTransactionRequest extends FormRequest
{
    /**
     * Checked before validation so a user lacking the permission gets 403, not 422.
     */
    public function authorize(): bool
    {
        return (bool) $this->user()?->can('agent.manage');
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $companyId = $this->user()->company_id;

        return [
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'mode_id' => ['required', Rule::exists('payment_modes', 'id')->where('company_id', $companyId)],
            'agent' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:1'],
            'date' => ['required', 'date'],
            'time' => ['required', 'date_format:H:i,H:i:s'],
        ];
    }

    /**
     * @return array{branch_id: int, payment_mode_id: int, agent: string, amount: float, date: string, time: string}
     */
    public function transactionData(): array
    {
        return [
            'branch_id' => $this->integer('blanch_id'),
            'payment_mode_id' => $this->integer('mode_id'),
            'agent' => $this->string('agent')->toString(),
            'amount' => $this->float('amount'),
            'date' => $this->date('date')->toDateString(),
            'time' => $this->string('time')->toString(),
        ];
    }
}
