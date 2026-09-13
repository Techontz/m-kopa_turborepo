<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\LoanCategory;
use App\Services\Customers\KycService;
use Illuminate\Validation\ValidationException;

/**
 * Loan eligibility of a customer from the category rule engine ("Category = Rule Engine": loan type,
 * loan limits, required documents, risk level) and KYC completion. Used by the Loans module.
 */
class CustomerEligibility
{
    public function __construct(private KycService $kyc) {}

    /**
     * Inferred: customers registered before NIDA KYC existed (no customer_kyc row) keep the live
     * behaviour — KYC complete when manually approved, every company loan product allowed, no limits.
     *
     * @return array{customer_id: int, kyc_status: string, kyc_complete: bool, eligible: bool, category: array{id: int, key: string, name: string}|null, risk_level: string|null, min_amount: float|null, max_amount: float|null, loan_category_ids: list<int>, checklist: list<array{key: string, label: string, done: bool}>, reasons: list<string>}
     */
    public function for(Customer $customer): array
    {
        $customer->loadMissing(['customerCategory.loanCategories', 'kyc']);
        $status = $this->kyc->status($customer);
        $category = $customer->customerCategory;
        $isLegacy = $status === 'legacy';

        $kycComplete = $isLegacy ? $customer->kyc_status === 'approved' : $status === 'completed';

        $loanCategoryIds = $category !== null
            ? $category->loanCategories->pluck('id')->map(fn ($id): int => (int) $id)->values()->all()
            : ($isLegacy ? LoanCategory::where('company_id', $customer->company_id)->pluck('id')->map(fn ($id): int => (int) $id)->values()->all() : []);

        $reasons = [];
        if (! $kycComplete) {
            $reasons[] = 'Please wait for the customer`s KYC to be Verfied!';
        }
        if ($category !== null && ! $category->is_active) {
            $reasons[] = 'Customer category is inactive';
        }
        if (! $isLegacy && $category === null) {
            $reasons[] = 'Customer category is not assigned';
        }

        return [
            'customer_id' => $customer->id,
            'kyc_status' => $status,
            'kyc_complete' => $kycComplete,
            'eligible' => $reasons === [],
            'category' => $category ? ['id' => $category->id, 'key' => $category->key, 'name' => $category->name] : null,
            'risk_level' => $category?->risk_level,
            'min_amount' => $category ? (float) $category->min_loan_amount : null,
            'max_amount' => $category && (float) $category->max_loan_amount > 0 ? (float) $category->max_loan_amount : null,
            'loan_category_ids' => $loanCategoryIds,
            'checklist' => $isLegacy ? [] : $this->kyc->checklist($customer),
            'reasons' => $reasons,
        ];
    }

    /**
     * Whether the customer may take the given loan product for the given amount.
     */
    public function allows(Customer $customer, int $loanCategoryId, ?float $amount = null): bool
    {
        return $this->violations($customer, $loanCategoryId, $amount) === [];
    }

    /**
     * @throws ValidationException
     */
    public function assertEligible(Customer $customer, ?int $loanCategoryId = null, ?float $amount = null, string $errorKey = 'customer_id'): void
    {
        $violations = $this->violations($customer, $loanCategoryId, $amount);

        if ($violations !== []) {
            throw ValidationException::withMessages([$errorKey => $violations]);
        }
    }

    /**
     * @return list<string>
     */
    public function violations(Customer $customer, ?int $loanCategoryId = null, ?float $amount = null): array
    {
        $rules = $this->for($customer);
        $violations = $rules['reasons'];

        if ($loanCategoryId !== null && ! in_array($loanCategoryId, $rules['loan_category_ids'], true)) {
            $violations[] = 'This loan product is not allowed for the customer category';
        }
        if ($amount !== null && $rules['min_amount'] !== null && $amount < $rules['min_amount']) {
            $violations[] = 'Loan amount is below the customer category minimum of '.number_format($rules['min_amount']);
        }
        if ($amount !== null && $rules['max_amount'] !== null && $amount > $rules['max_amount']) {
            $violations[] = 'Loan amount exceeds the customer category limit of '.number_format($rules['max_amount']);
        }

        return $violations;
    }
}
