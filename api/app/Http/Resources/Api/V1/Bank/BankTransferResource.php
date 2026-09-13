<?php

namespace App\Http\Resources\Api\V1\Bank;

use App\Enums\Account;
use App\Models\BankTransfer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin BankTransfer
 */
class BankTransferResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'branch_account' => $this->branch_account,
            'branch_account_label' => $this->branch_account ? Account::tryFrom($this->branch_account)?->label() : null,
            'bank_account_id' => $this->bank_account_id,
            'bank_account' => $this->bankAccount?->name,
            'hq_account' => $this->hq_account,
            'hq_account_label' => $this->hq_account ? Account::tryFrom($this->hq_account)?->label() : null,
            'amount' => (float) $this->amount,
            'charge' => (float) $this->charge,
            'status' => $this->status,
            'transfer_date' => $this->transfer_date?->toDateString(),
        ];
    }
}
