<?php

namespace App\Http\Resources\Api\V1\Hq;

use App\Enums\Account;
use App\Models\HqTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin HqTransaction
 */
class HqTransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_account' => $this->from_account,
            'from_account_label' => Account::tryFrom($this->from_account)?->label(),
            'to_account' => $this->to_account,
            'to_account_label' => Account::tryFrom($this->to_account)?->label(),
            'amount' => (float) $this->amount,
            'charge' => (float) $this->charge,
            'status' => $this->status,
            'staff' => $this->employee?->full_name,
            'date' => $this->created_at?->toDateString(),
            'approved_at' => $this->approved_at?->toDateString(),
        ];
    }
}
