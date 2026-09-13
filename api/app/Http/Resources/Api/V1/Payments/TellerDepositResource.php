<?php

namespace App\Http\Resources\Api\V1\Payments;

use App\Models\TellerDeposit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TellerDeposit
 */
class TellerDepositResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $expected = round((float) $this->payments->sum('amount'), 2);

        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'teller' => $this->employee?->full_name,
            'bank_account_id' => $this->bank_account_id,
            'bank_account' => $this->bankAccount?->name,
            'slip_number' => $this->slip_number,
            'amount' => (float) $this->amount,
            'expected_amount' => $expected,
            'difference' => round((float) $this->amount - $expected, 2),
            'deposit_date' => $this->deposit_date?->toDateString(),
            'status' => $this->status,
            'statement_amount' => $this->statement_amount === null ? null : (float) $this->statement_amount,
            'statement_reference' => $this->statement_reference,
            'verifier' => $this->verifier?->full_name,
            'verified_at' => $this->verified_at?->toDateTimeString(),
            'confirmer' => $this->confirmer?->full_name,
            'confirmed_at' => $this->confirmed_at?->toDateTimeString(),
            'rejection_reason' => $this->rejection_reason,
            'payments' => PaymentResource::collection($this->payments),
        ];
    }
}
