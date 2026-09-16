<?php

namespace App\Http\Resources\Api\V1\Hrm;

use App\Models\Employee;
use App\Models\StaffLoan;
use App\Services\Hrm\StaffCredit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

/**
 * @mixin StaffLoan
 */
class StaffLoanResource extends JsonResource
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
            'amount_applied' => (float) $this->amount_applied,
            'amount_approved' => (float) $this->amount_approved,
            'duration' => $this->duration,
            'sessions' => $this->sessions,
            'total_payable' => (float) $this->total_payable,
            'restoration' => (float) $this->restoration,
            'fee' => (float) $this->fee,
            'paid_amount' => $this->paidAmount(),
            'remaining_amount' => $this->remainingAmount(),
            'reason' => $this->reason,
            'status' => $this->status,
            'approved_at' => $this->approved_at?->toDateTimeString(),
            'disbursed_at' => $this->disbursed_at?->toDateTimeString(),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn ($payment): array => ['id' => $payment->id, 'amount' => (float) $payment->amount, 'paid_on' => $payment->paid_on?->toDateString()])),
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
