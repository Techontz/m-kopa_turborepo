<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\Customers\KycStatusCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Loan eligibility of a customer from the customer type (allowed loan products, loan limits, risk level)
 * and KYC completion (`kyc_status` = completed). Used by the Loans module.
 *
 * The re-borrowing freeze is reported separately (`freeze`): a customer can be eligible but frozen, and may apply
 * only when eligible AND not frozen (`can_apply`). A freeze started by a loan of any category blocks every new loan
 * of the customer until it ends — it is a customer re-borrowing freeze whose length comes from the loan's category.
 */
class CustomerEligibility
{
    public function __construct(private KycStatusCalculator $kyc) {}

    /**
     * A customer without a customer type may take every loan product of the company, without limits.
     *
     * @return array{customer_id: int, kyc_status: string, kyc_complete: bool, eligible: bool, category: array{id: int, key: string|null, code: string|null, name: string}|null, risk_level: string|null, min_amount: float|null, max_amount: float|null, loan_category_ids: list<int>, checklist: list<array{key: string, label: string, required: bool, complete: bool}>, reasons: list<string>, freeze: array<string, mixed>, can_apply: bool}
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
            $reasons[] = "Please wait for the customer's KYC to be verified!";
        }
        if ($category !== null && ! $category->is_active) {
            $reasons[] = 'Customer type is inactive';
        }

        $freeze = $this->freeze($customer);

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
            'freeze' => $freeze,
            'can_apply' => $reasons === [] && ! $freeze['frozen'],
        ];
    }

    /**
     * Current re-borrowing freeze of the customer: FROZEN while now() < frozen_until (timestamp compare), otherwise
     * FREEZE EXPIRED when a past freeze exists, else no freeze.
     *
     * @return array{status: 'frozen'|'expired'|'none', frozen: bool, loan_id: int|null, loan_number: string|null, loan_category: string|null, freeze_days: int|null, freeze_started_at: string|null, frozen_until: string|null, remaining_seconds: int, checked_at: string, message: string|null}
     */
    public function freeze(Customer $customer): array
    {
        $now = CarbonImmutable::now();
        $loan = $customer->loans()->whereNotNull('frozen_until')->where('frozen_until', '>', $now)->with('category')->orderByDesc('frozen_until')->first()
            ?? $customer->loans()->whereNotNull('frozen_until')->with('category')->orderByDesc('frozen_until')->first();
        $frozen = $loan !== null && $loan->frozen_until->gt($now);

        return [
            'status' => $loan === null ? 'none' : ($frozen ? 'frozen' : 'expired'),
            'frozen' => $frozen,
            'loan_id' => $loan?->id,
            'loan_number' => $loan?->loan_number,
            'loan_category' => $loan?->category?->name,
            'freeze_days' => $loan?->freeze_days,
            'freeze_started_at' => $loan?->freeze_started_at?->toIso8601String(),
            'frozen_until' => $loan?->frozen_until?->toIso8601String(),
            'remaining_seconds' => $frozen ? (int) $now->diffInSeconds($loan->frozen_until, true) : 0,
            'checked_at' => $now->toIso8601String(),
            'message' => $frozen ? self::freezeMessage($loan) : null,
        ];
    }

    /**
     * "Customer is currently frozen and cannot apply for another loan until 17 September 2026 10:00" (time only when
     * the freeze does not end at midnight).
     */
    public static function freezeMessage(Loan $loan): string
    {
        $until = CarbonImmutable::parse($loan->frozen_until);
        $format = $until->format('H:i:s') === '00:00:00' ? 'j F Y' : 'j F Y H:i';

        return 'Customer is currently frozen and cannot apply for another loan until '.$until->format($format).'.';
    }

    /**
     * @throws ValidationException when the customer is under a re-borrowing freeze
     */
    public function assertNotFrozen(Customer $customer, string $errorKey = 'customer_id'): void
    {
        $freeze = $this->freeze($customer);

        if ($freeze['frozen']) {
            throw ValidationException::withMessages([$errorKey => $freeze['message']]);
        }
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
            $violations[] = 'This loan product is not allowed for the customer type';
        }
        if ($amount !== null && $rules['min_amount'] !== null && $amount < $rules['min_amount']) {
            $violations[] = 'Loan amount is below the customer type minimum of '.number_format($rules['min_amount']);
        }
        if ($amount !== null && $rules['max_amount'] !== null && $amount > $rules['max_amount']) {
            $violations[] = 'Loan amount exceeds the customer type limit of '.number_format($rules['max_amount']);
        }

        return $violations;
    }
}
