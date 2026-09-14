<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\Customers\KycStatusCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Loan eligibility of a customer from the business hierarchy CUSTOMER TYPE → MAIN LOAN CATEGORY → LOAN CATEGORY and KYC
 * completion (`kyc_status` = completed). Used by the Loans module.
 *
 * A customer may take only the ACTIVE loan categories (LoanCategory::scopeActive — main loan category enabled, category
 * assigned to the customer's branch) of its customer type's main loan category; the amount limits are the loan category's
 * amount_from / amount_to. Customer types hold no loan rules.
 *
 * The re-borrowing freeze is reported separately (`freeze`): a customer can be eligible but frozen, and may apply
 * only when eligible AND not frozen (`can_apply`). A freeze started by a loan of any category blocks every new loan
 * of the customer until it ends — it is a customer re-borrowing freeze whose length comes from the loan's category.
 */
class CustomerEligibility
{
    public const NO_CUSTOMER_TYPE = 'Assign a customer type to this customer before applying for a loan.';

    public function __construct(private KycStatusCalculator $kyc) {}

    /**
     * @return array{customer_id: int, kyc_status: string, kyc_complete: bool, eligible: bool, category: array{id: int, key: string|null, code: string|null, name: string}|null, main_category: array{id: int, name: string, is_enabled: bool}|null, risk_level: string|null, loan_category_ids: list<int>, checklist: list<array{key: string, label: string, required: bool, complete: bool}>, reasons: list<string>, freeze: array<string, mixed>, can_apply: bool}
     */
    public function for(Customer $customer): array
    {
        $customer->loadMissing('customerCategory.mainLoanCategory');
        $category = $customer->customerCategory;
        $main = $category?->mainLoanCategory;
        $kycComplete = $customer->kyc_status === KycStatusCalculator::COMPLETED;

        $reasons = [];
        if ($category === null) {
            $reasons[] = self::NO_CUSTOMER_TYPE;
        } elseif (! $category->is_active || $category->trashed()) {
            $reasons[] = 'Customer type is inactive';
        }
        if (! $kycComplete) {
            $reasons[] = "Please wait for the customer's KYC to be verified!";
        }

        $freeze = $this->freeze($customer);

        return [
            'customer_id' => $customer->id,
            'kyc_status' => (string) $customer->kyc_status,
            'kyc_complete' => $kycComplete,
            'eligible' => $reasons === [],
            'category' => $category ? ['id' => $category->id, 'key' => $category->key, 'code' => $category->code, 'name' => $category->name] : null,
            'main_category' => $main ? ['id' => $main->id, 'name' => $category->name, 'is_enabled' => (bool) $main->is_enabled] : null,
            'risk_level' => $category?->risk_level,
            'loan_category_ids' => $this->availableLoanCategories($customer)->pluck('id')->map(fn ($id): int => (int) $id)->values()->all(),
            'checklist' => $this->kyc->checklist($customer),
            'reasons' => $reasons,
            'freeze' => $freeze,
            'can_apply' => $reasons === [] && ! $freeze['frozen'],
        ];
    }

    /**
     * Loan categories the customer may apply for: the active categories (at the customer's branch) of the customer type's
     * main loan category. Empty without a customer type.
     *
     * @return Collection<int, LoanCategory>
     */
    public function availableLoanCategories(Customer $customer): Collection
    {
        $customer->loadMissing('customerCategory.mainLoanCategory');
        $main = $customer->customerCategory?->mainLoanCategory;

        if ($main === null) {
            return new Collection;
        }

        return LoanCategory::query()
            ->where('company_id', $customer->company_id)
            ->where('main_category_id', $main->id)
            ->active((int) $customer->branch_id)
            ->orderBy('id')
            ->get();
    }

    /**
     * Hierarchy check for one loan category: the customer has a customer type and the category is an active category of
     * that type's main loan category (a loan category id sent manually for another type is refused).
     *
     * @return list<string>
     */
    public function loanCategoryViolations(Customer $customer, int $loanCategoryId): array
    {
        $customer->loadMissing('customerCategory.mainLoanCategory');
        $type = $customer->customerCategory;

        if ($type === null) {
            return [self::NO_CUSTOMER_TYPE];
        }

        $category = LoanCategory::query()->where('company_id', $customer->company_id)->find($loanCategoryId);
        if ($category === null || $type->mainLoanCategory === null || (int) $category->main_category_id !== (int) $type->mainLoanCategory->id) {
            return ["This loan category is not available for the customer's customer type ({$type->name})."];
        }
        if (! $type->mainLoanCategory->is_enabled) {
            return ["This loan category is not active for the customer's customer type ({$type->name})."];
        }
        if (! $this->availableLoanCategories($customer)->contains('id', $category->id)) {
            return ['This loan category is not available for the customer branch'];
        }

        return [];
    }

    /**
     * @throws ValidationException when the loan category is outside the customer's customer type hierarchy
     */
    public function assertLoanCategoryAvailable(Customer $customer, int $loanCategoryId, string $errorKey = 'category_id'): void
    {
        $violations = $this->loanCategoryViolations($customer, $loanCategoryId);

        if ($violations !== []) {
            $key = $violations === [self::NO_CUSTOMER_TYPE] && in_array($errorKey, ['category_id', 'loan_category_id'], true) ? 'customer_id' : $errorKey;

            throw ValidationException::withMessages([$key => $violations]);
        }
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
     * Eligibility reasons plus, for a loan category, the hierarchy check and the category's amount limits.
     *
     * @return list<string>
     */
    public function violations(Customer $customer, ?int $loanCategoryId = null, ?float $amount = null): array
    {
        $violations = $this->for($customer)['reasons'];

        if ($loanCategoryId === null) {
            return $violations;
        }

        $hierarchy = $this->loanCategoryViolations($customer, $loanCategoryId);
        $violations = array_values(array_unique([...$violations, ...$hierarchy]));

        $category = LoanCategory::find($loanCategoryId);
        if ($hierarchy === [] && $amount !== null && $category !== null && ($amount < (float) $category->amount_from || $amount > (float) $category->amount_to)) {
            $violations[] = "Loan amount must be between {$category->level_label}";
        }

        return $violations;
    }
}
