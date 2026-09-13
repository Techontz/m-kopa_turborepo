<?php

namespace App\Http\Resources\Api\V1\Customers;

use App\Models\Customer;
use App\Models\CustomerDocument;
use App\Models\Guarantor;
use App\Models\Loan;
use App\Services\Customers\KycService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Live customer profile (header, Basic, Aditional Details, Guarantors, All Loans) extended with KYC data.
 *
 * @mixin Customer
 */
class CustomerProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $kycService = app(KycService::class);
        $kyc = $this->kyc;

        return [
            'id' => $this->id,
            'customer_code' => $this->customer_code,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'short_name' => $this->short_name,
            'gender' => $this->gender,
            'date_of_birth' => $this->date_of_birth?->toDateString(),
            'age' => $this->age,
            'phone' => $this->phone,
            'branch_id' => $this->branch_id,
            'branch' => $this->branch?->name,
            'employee_id' => $this->employee_id,
            'employee' => $this->employee?->full_name,
            'work_status' => $this->work_status,
            'customer_type' => $this->customer_type,
            'region_id' => $this->region_id,
            'region' => $this->residence?->region_name ?? $this->region?->name,
            'district' => $this->district,
            'ward' => $this->ward,
            'street' => $this->street,
            'nickname' => $this->nickname,
            'marital_status' => $this->marital_status,
            'business_type' => $this->business_type,
            'place_of_business' => $this->place_of_business,
            'dependents' => $this->dependents,
            'monthly_income' => $this->monthly_income !== null ? (float) $this->monthly_income : null,
            'id_number' => $this->id_number,
            'check_number' => $this->check_number,
            'account_number' => $this->account_number,
            'status' => $this->status,
            'status_label' => $this->status_label,
            'kyc_status' => $this->kyc_status,
            'is_marked' => $this->is_marked,
            'registration_step' => $this->registration_step,
            'created_at' => $this->created_at?->format('Y-m-d H:i:s'),
            'photo_url' => $kyc?->face_photo ? "customers/{$this->id}/photo" : null,
            'legacy_attachment' => $this->id_attachment ? basename($this->id_attachment) : null,
            'category' => $this->customerCategory ? [
                'id' => $this->customerCategory->id,
                'key' => $this->customerCategory->key,
                'name' => $this->customerCategory->name,
                'icon' => $this->customerCategory->icon,
                'risk_level' => $this->customerCategory->risk_level,
                'required_documents' => $this->customerCategory->required_documents,
            ] : null,
            'kyc' => [
                'state' => $kycService->status($this->resource),
                'checklist' => $kyc ? $kycService->checklist($this->resource) : [],
                'nida' => $kyc ? collect($kyc->nida_data)->except('photo')->all() : null,
                'nida_verified_at' => $kyc?->nida_verified_at?->format('Y-m-d H:i'),
                'otp_verified_at' => $kyc?->otp_verified_at?->format('Y-m-d H:i'),
                'face_verified_at' => $kyc?->face_verified_at?->format('Y-m-d H:i'),
                'face_liveness_score' => $kyc?->face_liveness_score,
                'face_match_score' => $kyc?->face_match_score,
                'category_answers' => $kyc?->category_answers,
                'completed_at' => $kyc?->completed_at?->format('Y-m-d H:i'),
            ],
            'residence' => $this->residence?->only(['region_code', 'region_name', 'district_code', 'district_name', 'ward_code', 'ward_name', 'street_name', 'ownership']),
            'bank' => $this->bankDetail?->only(['bank_name', 'account_number', 'account_name', 'check_number', 'phone']),
            'next_of_kin' => $this->nextOfKin?->only(['first_name', 'middle_name', 'last_name', 'phone', 'relationship']),
            'documents' => $this->documents->map(fn (CustomerDocument $document): array => [
                'id' => $document->id,
                'document_type' => $document->document_type,
                'original_name' => $document->original_name,
                'size' => $document->size,
                'uploaded_at' => $document->created_at?->format('Y-m-d H:i'),
                'url' => "customers/{$this->id}/documents/{$document->id}/file",
            ])->values(),
            'guarantors' => $this->guarantors->map(fn (Guarantor $guarantor): array => $guarantor->only(['id', 'first_name', 'middle_name', 'last_name', 'phone', 'gender', 'marital_status', 'id_number', 'relationship', 'region_id', 'district', 'ward', 'street']) + ['region' => $guarantor->region?->name])->values(),
            'loans' => $this->loans->sortByDesc('id')->map(fn (Loan $loan): array => [
                'id' => $loan->id,
                'loan_number' => $loan->loan_number,
                'product' => $loan->category?->name,
                'interest_rate' => (float) $loan->interest_rate,
                'amount_withdrawn' => $loan->withdrawn_at ? (float) $loan->amount_approved : 0,
                'total_payable' => $loan->withdrawn_at ? (float) $loan->total_payable : 0,
                'duration' => $loan->duration?->label(),
                'sessions' => $loan->sessions,
                'restoration' => $loan->withdrawn_at ? (float) $loan->restoration : 0,
                'status' => $loan->status?->label(),
                'status_badge' => $loan->status?->badge(),
                'withdrawn_at' => $loan->withdrawn_at?->toDateString(),
                'end_date' => $loan->end_date?->toDateString(),
            ])->values(),
        ];
    }
}
