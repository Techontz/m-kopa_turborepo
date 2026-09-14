<?php

namespace Tests\Feature\Api\Loans;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\Ledger;
use App\Services\LoanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Loan category Freeze Time (Days): the re-borrowing freeze recorded on the loan and enforced by the eligibility
 * rules, the loan application endpoint and the approvals.
 */
class LoanFreezeTimeApiTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private Customer $customer;

    private LoanCategory $category;

    private CustomerCategory $customerType;

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.vodacom.driver' => 'test', 'integrations.bank_mandate.driver' => 'test', 'integrations.vodacom.test_outcome' => 'success']);
        $this->travelTo('2026-09-01 08:00:00');
        $this->admin = $this->signInAdmin();
        $this->customerType = CustomerCategory::factory()->create(['company_id' => $this->admin->company_id]);
        $this->customer = Customer::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id, 'phone' => '255754000123', 'customer_category_id' => $this->customerType->id]);
        $this->category = $this->category(['freeze_time_days' => 7, 'topup_percent' => 0]);
        app(Ledger::class)->openingBalance($this->admin->company_id, Account::Principal, 5000000, 'FLOAT', $this->admin->branch_id);
    }

    public function test_closure_starts_the_freeze_at_the_event_time_with_the_category_length(): void
    {
        $loan = $this->toActive();
        $this->assertNull($loan->freeze_started_at);
        $this->assertSame('2026-09-01', $loan->created_at->toDateString());

        $this->travelTo('2026-09-10 10:00:00');
        app(LoanService::class)->deposit($loan, 130000, now()->toImmutable());

        $loan->refresh();
        $this->assertSame(LoanStatus::Closed, $loan->status);
        $this->assertSame('2026-09-10 10:00:00', $loan->freeze_started_at->toDateTimeString());
        $this->assertSame(7, $loan->freeze_days);
        $this->assertSame('2026-09-17 10:00:00', $loan->frozen_until->toDateTimeString());
        $this->assertDatabaseHas('loans', ['id' => $loan->id, 'freeze_started_at' => '2026-09-10 10:00:00', 'freeze_days' => 7, 'frozen_until' => '2026-09-17 10:00:00']);

        $this->category->update(['freeze_time_days' => 60]);
        $this->travelTo('2026-09-11 12:00:00');
        app(LoanService::class)->startFreeze($loan);
        $this->assertSame('2026-09-17 10:00:00', $loan->fresh()->frozen_until->toDateTimeString(), 'A later event or category edit never restarts or rewrites the freeze.');

        $this->getJson(route('api.v1.loans.show', $loan))->assertOk()
            ->assertJsonPath('data.loan.freeze_days', 7)
            ->assertJsonPath('data.loan.freeze_started_at', '2026-09-10T10:00:00+00:00')
            ->assertJsonPath('data.loan.frozen_until', '2026-09-17T10:00:00+00:00')
            ->assertJsonPath('data.customer_freeze.status', 'frozen');
    }

    public function test_eligible_customer_is_blocked_while_frozen_on_every_endpoint_and_allowed_after_expiry(): void
    {
        $this->closeLoanAt('2026-09-10 10:00:00');
        $message = 'Customer is currently frozen and cannot apply for another loan until 17 September 2026 10:00.';

        foreach (['2026-09-15 10:00:00', '2026-09-17 09:59:59'] as $moment) {
            $this->travelTo($moment);

            $this->getJson(route('api.v1.loans.categories', $this->customer))->assertOk()
                ->assertJsonPath('eligibility.eligible', true)
                ->assertJsonPath('eligibility.frozen', true)
                ->assertJsonPath('eligibility.allowed', false)
                ->assertJsonPath('eligibility.reasons.0', $message)
                ->assertJsonPath('eligibility.frozen_until', '2026-09-17T10:00:00+00:00')
                ->assertJsonPath('eligibility.freeze.status', 'frozen')
                ->assertJsonPath('eligibility.freeze.freeze_days', 7)
                ->assertJsonPath('eligibility.freeze.freeze_started_at', '2026-09-10T10:00:00+00:00');

            $this->getJson("/api/v1/customers/{$this->customer->id}/eligibility")->assertOk()
                ->assertJsonPath('data.eligible', true)
                ->assertJsonPath('data.freeze.frozen', true)
                ->assertJsonPath('data.can_apply', false);

            $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()->assertJsonPath('errors.customer_id.0', $message);
        }

        $this->getJson(route('api.v1.loans.categories', $this->customer))->assertJsonPath('eligibility.freeze.remaining_seconds', 1);
        $this->assertSame(1, Loan::count());

        $this->travelTo('2026-09-17 10:00:00');
        $this->getJson(route('api.v1.loans.categories', $this->customer))->assertOk()
            ->assertJsonPath('eligibility.allowed', true)
            ->assertJsonPath('eligibility.frozen', false)
            ->assertJsonPath('eligibility.frozen_until', null)
            ->assertJsonPath('eligibility.freeze.status', 'expired')
            ->assertJsonPath('eligibility.freeze.remaining_seconds', 0);
        $this->getJson("/api/v1/customers/{$this->customer->id}/eligibility")->assertJsonPath('data.can_apply', true);
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertCreated();
    }

    public function test_after_expiry_the_normal_eligibility_rules_decide(): void
    {
        $this->closeLoanAt('2026-09-10 10:00:00');
        $this->customer->update(['kyc_status' => 'pending']);

        $this->travelTo('2026-09-12 10:00:00');
        $response = $this->getJson(route('api.v1.loans.categories', $this->customer))->assertOk()
            ->assertJsonPath('eligibility.eligible', false)
            ->assertJsonPath('eligibility.frozen', true);
        $this->assertContains("Please wait for the customer's KYC to be verified!", $response->json('eligibility.reasons'), 'The freeze does not hide other violations.');

        $this->travelTo('2026-09-18 10:00:00');
        $this->getJson(route('api.v1.loans.categories', $this->customer))
            ->assertJsonPath('eligibility.frozen', false)
            ->assertJsonPath('eligibility.allowed', false)
            ->assertJsonPath('eligibility.reasons.0', "Please wait for the customer's KYC to be verified!");
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()->assertJsonPath('errors.customer_id.0', "Please wait for the customer's KYC to be verified!");

        $this->customer->update(['kyc_status' => 'completed']);
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertCreated();
    }

    public function test_zero_freeze_time_keeps_normal_behaviour(): void
    {
        $this->category->update(['freeze_time_days' => 0]);
        $loan = $this->closeLoanAt('2026-09-10 10:00:00');

        $this->assertSame('2026-09-10 10:00:00', $loan->freeze_started_at->toDateTimeString());
        $this->assertSame(0, $loan->freeze_days);
        $this->assertNull($loan->frozen_until);

        $this->getJson(route('api.v1.loans.categories', $this->customer))->assertOk()
            ->assertJsonPath('eligibility.allowed', true)
            ->assertJsonPath('eligibility.freeze.status', 'none');
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertCreated();
    }

    public function test_thirty_days_freeze_ends_at_midnight_without_a_time_in_the_message(): void
    {
        $this->category->update(['freeze_time_days' => 30]);
        $loan = $this->closeLoanAt('2026-09-15 00:00:00');

        $this->assertSame('2026-10-15 00:00:00', $loan->frozen_until->toDateTimeString());
        $this->travelTo('2026-10-14 23:00:00');
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer is currently frozen and cannot apply for another loan until 15 October 2026.');
    }

    public function test_top_up_threshold_starts_the_freeze_and_closure_does_not_restart_it(): void
    {
        $this->category->update(['freeze_time_days' => 30, 'topup_percent' => 50]);
        $loan = $this->toActive();
        $service = app(LoanService::class);

        $this->travelTo('2026-09-05 09:00:00');
        $service->deposit($loan, 20000, now()->toImmutable());
        $this->assertNull($loan->fresh()->freeze_started_at, 'Below the top-up percent the customer is not yet eligible to borrow again.');

        $this->travelTo('2026-09-06 11:30:00');
        $service->deposit($loan, 50000, now()->toImmutable());
        $loan->refresh();
        $this->assertSame(LoanStatus::Active, $loan->status);
        $this->assertSame('2026-09-06 11:30:00', $loan->freeze_started_at->toDateTimeString());
        $this->assertSame('2026-10-06 11:30:00', $loan->frozen_until->toDateTimeString());

        $this->getJson(route('api.v1.loans.categories', $this->customer))
            ->assertJsonPath('eligibility.topup.eligible', true)
            ->assertJsonPath('eligibility.eligible', true)
            ->assertJsonPath('eligibility.allowed', false);
        $this->postJson(route('api.v1.loans.store'), $this->form(['how_loan' => 200000]))->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer is currently frozen and cannot apply for another loan until 6 October 2026 11:30.');

        $this->travelTo('2026-09-20 11:30:00');
        $service->deposit($loan, 60000, now()->toImmutable());
        $loan->refresh();
        $this->assertSame(LoanStatus::Closed, $loan->status);
        $this->assertSame('2026-09-06 11:30:00', $loan->freeze_started_at->toDateTimeString());
        $this->assertSame('2026-10-06 11:30:00', $loan->frozen_until->toDateTimeString());
    }

    public function test_different_categories_have_different_periods_and_the_freeze_blocks_every_category(): void
    {
        $long = $this->category(['name' => 'MSHAHARA', 'freeze_time_days' => 14, 'topup_percent' => 0]);
        $other = Customer::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id, 'phone' => '255754000999', 'customer_category_id' => $this->customerType->id]);

        $short = $this->closeLoanAt('2026-09-10 10:00:00');
        $this->assertSame('2026-09-17 10:00:00', $short->frozen_until->toDateTimeString());

        $this->travelTo('2026-09-01 08:00:00');
        $loan = $this->toActive($other, $long);
        $this->travelTo('2026-09-10 10:00:00');
        app(LoanService::class)->deposit($loan, 130000, now()->toImmutable());
        $this->assertSame(14, $loan->fresh()->freeze_days);
        $this->assertSame('2026-09-24 10:00:00', $loan->fresh()->frozen_until->toDateTimeString());

        $this->travelTo('2026-09-20 10:00:00');
        $this->postJson(route('api.v1.loans.store'), $this->form(['category_id' => $long->id]))->assertCreated();
        $this->postJson(route('api.v1.loans.store'), $this->form(['customer_id' => $other->id, 'category_id' => $this->category->id]))->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer is currently frozen and cannot apply for another loan until 24 September 2026 10:00.');
    }

    public function test_approvals_recheck_the_freeze(): void
    {
        $pending = $this->applyLoan();
        $frozen = Loan::factory()->create([
            'customer_id' => $this->customer->id, 'loan_category_id' => $this->category->id, 'status' => LoanStatus::Closed,
            'freeze_started_at' => '2026-08-30 08:00:00', 'freeze_days' => 7, 'frozen_until' => '2026-09-06 08:00:00',
        ]);
        $message = 'Customer is currently frozen and cannot apply for another loan until 6 September 2026 08:00.';

        $this->postJson(route('api.v1.loans.approve-manager', $pending), ['loan_aprove' => 100000])->assertUnprocessable()->assertJsonPath('errors.loan_aprove.0', $message);
        $this->assertSame(LoanStatus::PendingManagerApproval, $pending->fresh()->status);

        $this->travelTo('2026-09-06 08:00:00');
        $this->postJson(route('api.v1.loans.approve-manager', $pending), ['loan_aprove' => 100000])->assertOk();
        $this->postJson(route('api.v1.loans.kyc-verify', $pending))->assertOk();

        $frozen->update(['frozen_until' => '2026-09-07 08:00:00']);
        $this->postJson(route('api.v1.loans.approve-credit', $pending))->assertUnprocessable()
            ->assertJsonPath('errors.loan.0', 'Customer is currently frozen and cannot apply for another loan until 7 September 2026 08:00.');
    }

    public function test_legacy_end_of_day_freeze_is_still_honoured(): void
    {
        Loan::factory()->create([
            'customer_id' => $this->customer->id, 'loan_category_id' => $this->category->id, 'status' => LoanStatus::Closed,
            'freeze_started_at' => null, 'freeze_days' => null, 'frozen_until' => '2026-09-03 23:59:59',
        ]);

        $this->travelTo('2026-09-03 23:00:00');
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer is currently frozen and cannot apply for another loan until 3 September 2026 23:59.');

        $this->travelTo('2026-09-04 00:00:00');
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertCreated();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function category(array $attributes): LoanCategory
    {
        $category = LoanCategory::factory()->forCustomerType($this->customerType)->create($attributes + ['insurance' => 0]);
        $category->branches()->attach($this->admin->branch_id);

        return $category;
    }

    private function closeLoanAt(string $moment): Loan
    {
        $loan = $this->toActive();
        $this->travelTo($moment);
        app(LoanService::class)->deposit($loan, 130000, now()->toImmutable());

        return $loan->fresh();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function form(array $overrides = []): array
    {
        return $overrides + [
            'customer_id' => $this->customer->id, 'category_id' => $this->category->id, 'how_loan' => 100000,
            'session' => 1, 'rate' => 'SIMPLE', 'fee_status' => 'YES', 'reason' => 'BIASHARA',
        ];
    }

    private function applyLoan(?Customer $customer = null, ?LoanCategory $category = null): Loan
    {
        $this->postJson(route('api.v1.loans.store'), $this->form(['customer_id' => ($customer ?? $this->customer)->id, 'category_id' => ($category ?? $this->category)->id]))->assertCreated();

        return Loan::latest('id')->firstOrFail();
    }

    private function toActive(?Customer $customer = null, ?LoanCategory $category = null): Loan
    {
        $loan = $this->applyLoan($customer, $category);
        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertOk();
        $this->postJson(route('api.v1.loans.kyc-verify', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.approve-credit', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.disburse', $loan))->assertOk();

        return $loan->fresh();
    }
}
