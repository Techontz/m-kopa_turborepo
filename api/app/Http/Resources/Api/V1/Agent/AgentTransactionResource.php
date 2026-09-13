<?php

namespace App\Http\Resources\Api\V1\Agent;

use App\Models\AgentTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AgentTransaction
 */
class AgentTransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'payment_mode' => $this->paymentMode?->name,
            'agent' => $this->agent,
            'customer' => $this->customer?->full_name,
            'user' => $this->employee?->full_name,
            'amount' => (float) $this->amount,
            'loan_amount' => (float) $this->loan_amount,
            'transaction_time' => $this->transaction_time,
            'transaction_date' => $this->transaction_date->toDateString(),
            'reversed' => $this->reversed_at !== null,
            'reversal_reason' => $this->reversal_reason,
        ];
    }
}
