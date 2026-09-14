<?php

namespace App\Http\Resources\Api\V1\Loans;

use App\Models\Loan;
use App\Models\LoanDisbursement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Loan row used by every loan list (pending, credit review, disbursement, disbursed, withdrawal, rejected).
 *
 * @mixin Loan
 */
class LoanResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'loan_number' => $this->loan_number,
            'reference_number' => $this->reference_number,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->whenLoaded('customer', fn () => $this->customer?->full_name),
            'customer_phone' => $this->whenLoaded('customer', fn () => $this->customer?->phone),
            'customer_status' => $this->whenLoaded('customer', fn () => $this->customer?->status),
            'customer_status_label' => $this->whenLoaded('customer', fn () => $this->customer?->status_label),
            'branch_id' => $this->branch_id,
            'branch' => $this->whenLoaded('branch', fn () => $this->branch?->name),
            'loan_category_id' => $this->loan_category_id,
            'category' => $this->whenLoaded('category', fn () => $this->category?->name),
            'requires_mandate' => $this->whenLoaded('category', fn () => (bool) $this->category?->requires_mandate),
            'group_id' => $this->group_id,
            'employee' => $this->whenLoaded('employee', fn () => $this->employee?->full_name),
            'amount_applied' => (float) $this->amount_applied,
            'amount_approved' => (float) $this->amount_approved,
            'interest_rate' => (float) $this->interest_rate,
            'interest_amount' => (float) $this->interest_amount,
            'total_payable' => (float) $this->total_payable,
            'restoration' => (float) $this->restoration,
            'instalment' => (float) $this->instalment,
            'loan_fee' => (float) $this->loan_fee,
            'insurance' => (float) $this->insurance,
            'fee_deduct' => $this->fee_deduct,
            'formula' => $this->formula,
            'duration' => $this->duration?->value,
            'duration_label' => $this->duration?->label(),
            'sessions' => $this->sessions,
            'reason' => $this->reason,
            'is_special' => $this->is_special,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_badge' => $this->status->badge(),
            'decision_reason' => $this->decision_reason,
            'telco_name' => $this->telco_name,
            'telco_matched' => $this->telco_matched,
            'telco_verified_at' => $this->telco_verified_at?->toDateTimeString(),
            'disbursement_channel' => $this->disbursement_channel,
            'disbursement_attempts' => (int) $this->disbursement_attempts,
            'latest_disbursement' => $this->whenLoaded('latestDisbursement', fn () => $this->latestDisbursement ? [
                'batch_id' => $this->latestDisbursement->batch_id,
                'attempt' => $this->latestDisbursement->attempt,
                'channel' => $this->latestDisbursement->channel,
                'amount' => (float) $this->latestDisbursement->amount,
                'status' => $this->latestDisbursement->status,
                'failure_reason' => $this->latestDisbursement->failure_reason,
                'source_account' => $this->latestDisbursement->source_account ?? LoanDisbursement::SOURCE_CASH,
                'source_bank_account_id' => $this->latestDisbursement->source_bank_account_id,
                'source_label' => $this->latestDisbursement->sourceLabel(),
                'provider_reference' => $this->latestDisbursement->provider_reference,
                'journal_reference' => $this->latestDisbursement->journalEntry?->reference,
                'completed_at' => $this->latestDisbursement->completed_at?->toDateTimeString(),
            ] : null),
            'days_past_due' => (int) $this->days_past_due,
            'topup_of_loan_id' => $this->topup_of_loan_id,
            'agreement_file' => $this->agreement_file ? asset('storage/'.$this->agreement_file) : null,
            'created_at' => $this->created_at?->toDateString(),
            'approved_at' => $this->approved_at?->toDateString(),
            'disbursed_at' => $this->disbursed_at?->toDateTimeString(),
            'withdrawn_at' => $this->withdrawn_at?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'closed_at' => $this->closed_at?->toDateString(),
            'freeze_started_at' => $this->freeze_started_at?->toIso8601String(),
            'freeze_days' => $this->freeze_days,
            'frozen_until' => $this->frozen_until?->toIso8601String(),
        ];
    }
}
