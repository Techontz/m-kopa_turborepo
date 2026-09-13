<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\LoanCategory;
use App\Services\Customers\KycStatusCalculator;
use Illuminate\Validation\ValidationException;

/**
 * Loan eligibility of a customer from the customer type (allowed loan products, loan limits, risk level)
 * and KYC completion (`kyc_status` = completed). Used by the Loans module.
 */
class CustomerEligibility
{
    public function __construct(private KycStatusCalculator $kyc) {}

    /**
     * A customer without a customer type may take every loan product of the company, without limits.
     *
     * @return array{customer_id: int, kyc_status: string, kyc_complete: bool, eligible: bool, category: array{id: int, key: string|null, code: string|null, name: string}|null, risk_level: string|null, min_amount: float|null, max_amount: float|null, loan_category_ids: list<int>, checklist: list<array{key: string, label: string, required: bool, complete: bool}>, reasons: list<string>}
     */
    public function for(Customer $customer): array
    {
        $customer->loadMissing('customerCategory.loanCategories');
        $category = $customer->customerCategory;
        $kycComplete = $customer->kyc_status === KycStatusCalculator::COMPLETED;

        $loanCategoryIds = $category !== null
            ? $category->loanCategories->pluck('id')->map(fn ($id): int => (int) $id)->values()->all()
            : LoanCategory::where('company_id', $customer->company_id)->pluck('id')->map(fn ($id): int => (int) $id)->values()->all();

        $reasons = [];
        if (! $kycComplete) {
            $reasons[] = 'Please wait for the customer`s KYC to be Verfied!';
        }
        if ($category !== null && ! $category->is_active) {
            $reasons[] = 'Customer category is inactive';
        }

        return [
            'customer_id' => $customer->id,
            'kyc_status' => (string) $customer->kyc_status,
            'kyc_complete' => $kycComplete,
            'eligible' => $reasons === [],
            'category' => $category ? ['id' => $category->id, 'key' => $category->key, 'code' => $category->code, 'name' => $category->name] : null,
            'risk_level' => $category?->risk_level,
            'min_amount' => $category && $category->min_loan_amount !== null ? (float) $category->min_loan_amount : null,
            'max_amount' => $category && (float) $category->max_loan_amount > 0 ? (float) $category->max_loan_amount : null,
            'loan_category_ids' => $loanCategoryIds,
            'checklist' => $this->kyc->checklist($customer),
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
