<?php

namespace App\Http\Resources\Api\V1\Hrm;

use App\Models\Employee;
use App\Models\StaffSalaryAdvance;
use App\Services\Hrm\StaffCredit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * @mixin StaffSalaryAdvance
 */
class StaffSalaryAdvanceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'employee_id' => $this->employee_id,
            'employee' => $this->whenLoaded('employee', fn () => $this->employee?->full_name),
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
            'amount' => (float) $this->amount,
            'fee' => (float) $this->fee,
            'recovered_amount' => (float) $this->recovered_amount,
            'outstanding_amount' => $this->status === 'disbursed' ? $this->outstandingAmount() : 0.0,
            'source_account' => $this->source_account,
            'status' => $this->status,
            'approved_at' => $this->approved_at?->toDateTimeString(),
            'disbursed_at' => $this->disbursed_at?->toDateTimeString(),
            'requested_by' => $this->requested_by,
            ...$this->approvalFlags($request),
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }

    /**
     * Rule 6 flags for the next step: approve (pending, hrm.manage / payroll.approve) or disburse (approved, payroll.pay).
     *
     * @return array{can_approve: bool, approve_blocked_reason: string|null}
     */
    private function approvalFlags(Request $request): array
    {
        $viewer = $request->user();
        $permitted = match ($this->status) {
            'pending' => Gate::allows('hrm.manage') || Gate::allows('payroll.approve'),
            'approved' => Gate::allows('payroll.pay'),
            default => false,
        };
        if (! $permitted || ! $viewer instanceof Employee) {
            return ['can_approve' => false, 'approve_blocked_reason' => null];
        }

        $reason = app(StaffCredit::class)->stepBlockedReason($this->resource, $viewer);

        return ['can_approve' => $reason === null, 'approve_blocked_reason' => $reason];
    }
}
