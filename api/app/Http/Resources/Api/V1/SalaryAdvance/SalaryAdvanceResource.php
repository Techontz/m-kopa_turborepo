<?php

namespace App\Http\Resources\Api\V1\SalaryAdvance;

use App\Models\SalaryAdvance;
use App\Models\SalaryAdvancePayment;
use App\Services\DashboardStatistics;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalaryAdvance
 */
class SalaryAdvanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $startDate = CarbonImmutable::parse($this->approved_at ?? $this->created_at);

        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'customer_id' => $this->customer_id,
            'customer' => $this->customer?->full_name,
            'phone' => $this->customer?->phone,
            'category' => $this->category?->name,
            'amount' => (float) $this->amount,
            'interest_rate' => (float) $this->interest_rate,
            'total_payable' => (float) $this->total_payable,
            'paid_amount' => $this->paid_amount,
            'remaining_amount' => $this->remaining_amount,
            'fee' => (float) $this->fee,
            'fee_status' => $feeStatus = $this->resource->feeStatus(),
            'fee_collectable' => $feeStatus === SalaryAdvance::FEE_UNCOLLECTED && in_array($this->status, ['active', 'done'], true) && $this->reversed_at === null,
            'fee_collected_at' => $this->fee_collected_at?->format('Y-m-d H:i:s'),
            'fee_collected_by' => $this->fee_collected_by === null ? null : $this->feeCollector?->full_name,
            'fee_collection_method' => $this->fee_collection_method,
            'status' => $this->status,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'approved_at' => $this->approved_at?->format('Y-m-d H:i:s'),
            'start_date' => $startDate->format('Y-m-d H:i:s'),
            'end_date' => today()->addMonthNoOverflow()->day(5)->toDateString(),
            'alert' => DashboardStatistics::repaymentCycleEnded($this->resource) ? 'old' : 'new',
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn (SalaryAdvancePayment $payment): array => [
                'id' => $payment->id,
                'amount' => (float) $payment->amount,
                'paid_on' => $payment->paid_on->toDateString(),
                'created_at' => $payment->created_at?->format('Y-m-d H:i:s'),
            ])->values()),
        ];
    }
}
