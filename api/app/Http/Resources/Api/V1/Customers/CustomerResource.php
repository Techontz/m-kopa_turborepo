<?php

namespace App\Http\Resources\Api\V1\Customers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Row of the live "All Customer" table.
 *
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'customer_code' => $this->customer_code,
            'full_name' => $this->full_name,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'age' => $this->age,
            'gender' => $this->gender,
            'phone' => $this->phone,
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'status' => $this->status,
            'status_label' => $this->status === 'close' ? 'DONE' : $this->status_label,
            'kyc_status' => $this->kyc_status,
            'category' => $this->whenLoaded('customerCategory', fn () => $this->customerCategory?->name),
            'is_marked' => $this->is_marked,
            'registration_step' => $this->registration_step,
        ];
    }
}
