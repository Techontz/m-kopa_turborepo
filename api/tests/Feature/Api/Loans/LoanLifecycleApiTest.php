<?php

namespace Tests\Feature\Api\Loans;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\LoanDisbursement;
use App\Services\Ledger;
use App\Services\LoanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\UsesSecondApprover;
use Tests\TestCase;

class LoanLifecycleApiTest extends TestCase
{
    use RefreshDatabase;
    use UsesSecondApprover;

    private Employee $admin;

    private Customer $customer;

    private LoanCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        config(['integrations.vodacom.driver' => 'test', 'integrations.bank_mandate.driver' => 'test', 'integrations.vodacom.test_outcome' => 'success']);
        $this->admin = $this->signInAdmin();
        // Rule 6 (initiator ≠ approver, stage separation) is covered by SegregationOfDutiesTest; these fixtures drive every
        // loan stage as one admin, so the company grants self-approval explicitly.
        $this->grantSelfApproval($this->admin);
        // Customer type → loan category: the customer may apply for the loan categories of its type.
        $customerType = CustomerCategory::factory()->create(['company_id' => $this->admin->company_id]);
        $this->customer = Customer::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id, 'phone' => '255754000123', 'customer_category_id' => $customerType->id]);
        $this->category = LoanCategory::factory()->forCustomerType($customerType)->create(['insurance' => 0]);
        $this->category->branches()->attach($this->admin->branch_id);
        app(Ledger::class)->openingBalance($this->admin->company_id, Account::Principal, 1000000, 'FLOAT', $this->admin->branch_id);
    }

    public function test_full_lifecycle_from_application_to_active_with_ledger_schedules_and_sms(): void
    {
        $loan = $this->applyLoan();
        $this->assertSame(LoanStatus::PendingManagerApproval, $loan->status);
        $this->assertEquals(130000, $loan->total_payable);

        $this->getJson(route('api.v1.loans.index', ['stage' => 'pending']))->assertOk()->assertJsonPath('data.0.loan_number', $loan->loan_number);

        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertOk()->assertJsonPath('message', 'Loan Approved successfully');
        $this->assertSame(LoanStatus::PendingCreditReview, $loan->fresh()->status);

        $this->postJson(route('api.v1.loans.approve-credit', $loan))->assertUnprocessable();
        $this->postJson(route('api.v1.loans.kyc-verify', $loan))->assertOk()->assertJsonPath('verification.matched', true);
        $this->postJson(route('api.v1.loans.approve-credit', $loan))->assertOk();
        $loan->refresh();
        $this->assertSame(LoanStatus::PendingFinance, $loan->status);
        $this->assertNotNull($loan->reference_number);

        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();
        $this->assertSame(LoanStatus::AwaitingDisbursement, $loan->fresh()->status);
        $this->assertEquals(0, app(Ledger::class)->balance($loan->company_id, Account::LoanReceivable, $loan->branch_id));

        $this->postJson(route('api.v1.loans.disburse', $loan))->assertOk()->assertJsonPath('message', 'Loan Disbursed successfully');

        $loan->refresh();
        $ledger = app(Ledger::class);
        $this->assertSame(LoanStatus::Active, $loan->status);
        $this->assertCount(1, $loan->schedules);
        $this->assertEquals(100000, $ledger->balance($loan->company_id, Account::LoanReceivable, $loan->branch_id));
        $this->assertEquals(900000, $ledger->balance($loan->company_id, Account::Principal, $loan->branch_id));
        $this->assertDatabaseHas('loan_disbursements', ['loan_id' => $loan->id, 'status' => LoanDisbursement::SUCCESS, 'amount' => 95000]);
        $this->assertDatabaseHas('sms_logs', ['customer_id' => $this->customer->id]);

        $this->getJson(route('api.v1.loans.show', $loan))->assertOk()
            ->assertJsonPath('data.loan.status_label', 'ACTIVE')
            ->assertJsonFragment(['action' => 'DISBURSED']);
    }

    public function test_application_validation_and_eligibility(): void
    {
        $this->postJson(route('api.v1.loans.store'), [])->assertUnprocessable()->assertJsonValidationErrors(['customer_id', 'category_id', 'how_loan', 'session']);

        $this->postJson(route('api.v1.loans.store'), $this->form(['how_loan' => 5000]))->assertUnprocessable()->assertJsonValidationErrors('how_loan');

        $this->customer->update(['kyc_status' => 'pending']);
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()->assertJsonValidationErrors('customer_id');
    }

    public function test_second_application_is_blocked_while_first_is_in_pipeline(): void
    {
        $this->applyLoan();

        $this->postJson(route('api.v1.loans.store'), $this->form())
            ->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer already has a loan waiting for approval or withdrawal');
    }

    public function test_loan_officer_cannot_approve_and_other_branch_loans_are_hidden(): void
    {
        $loan = $this->applyLoan();
        $otherBranch = Branch::factory()->create(['company_id' => $this->admin->company_id]);
        $officer = $this->employee('loan_officer', $this->admin->branch_id);
        $manager = $this->employee('branch_manager', $otherBranch->id);

        $this->actingAs($officer);
        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertForbidden();

        $this->actingAs($manager);
        $this->getJson(route('api.v1.loans.index', ['stage' => 'pending']))->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(route('api.v1.loans.show', $loan))->assertNotFound();
        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertNotFound();
    }

    public function test_manager_modify_returns_to_officer_and_resubmission_goes_back_to_manager(): void
    {
        $loan = $this->applyLoan();

        $this->postJson(route('api.v1.loans.modify', $loan), [])->assertJsonValidationErrors('reason');
        $this->postJson(route('api.v1.loans.modify', $loan), ['reason' => 'Amount too high'])->assertOk();
        $this->assertSame(LoanStatus::Returned, $loan->fresh()->status);

        $this->putJson(route('api.v1.loans.update', $loan), $this->form(['how_loan' => 80000]))->assertOk();
        $loan->refresh();
        $this->assertSame(LoanStatus::PendingManagerApproval, $loan->status);
        $this->assertEquals(80000, $loan->amount_applied);

        $this->postJson(route('api.v1.loans.reject', $loan), ['reason' => 'No business'])->assertOk();
        $this->assertSame(LoanStatus::Rejected, $loan->fresh()->status);
        $this->putJson(route('api.v1.loans.update', $loan), $this->form())->assertUnprocessable();
    }

    public function test_mandate_product_requires_otp_before_credit_review(): void
    {
        $this->category->update(['requires_mandate' => true]);
        $loan = $this->applyLoan();
        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertOk();
        $this->assertSame(LoanStatus::MandatePendingOtp, $loan->fresh()->status);

        $this->postJson(route('api.v1.loans.mandate.store', $loan), ['bank_name' => 'CRDB', 'account_number' => '0150123456', 'account_name' => 'TEST'])->assertOk();
        $this->postJson(route('api.v1.loans.mandate.verify-otp', $loan), ['otp' => '111111'])->assertUnprocessable()->assertJsonPath('message', 'Wrong OTP');
        $this->assertSame(LoanStatus::MandateFailed, $loan->fresh()->status);

        $this->postJson(route('api.v1.loans.mandate.verify-otp', $loan), ['otp' => '123456'])->assertOk();
        $this->assertSame(LoanStatus::PendingCreditReview, $loan->fresh()->status);
        $this->assertDatabaseHas('loan_mandates', ['loan_id' => $loan->id, 'status' => 'active', 'otp_attempts' => 2]);
    }

    public function test_telco_name_mismatch_blocks_credit_approval(): void
    {
        $this->customer->update(['phone' => '255754000000']);
        $loan = $this->toCreditReview();

        $this->postJson(route('api.v1.loans.kyc-verify', $loan))->assertOk()->assertJsonPath('verification.matched', false);
        $this->postJson(route('api.v1.loans.approve-credit', $loan))->assertUnprocessable()->assertJsonPath('errors.loan.0', 'Name mismatch: modify or reject the loan');
        $this->assertNull($loan->fresh()->reference_number);
    }

    public function test_failed_disbursement_retries_with_new_batch_then_escalates_without_ledger(): void
    {
        config(['integrations.vodacom.test_outcome' => 'failed']);
        $loan = $this->toFinance();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();

        $this->postJson(route('api.v1.loans.disburse', $loan))->assertUnprocessable();
        $this->assertSame(LoanStatus::DisbursementFailed, $loan->fresh()->status);

        $this->postJson(route('api.v1.loans.retry-disbursement', $loan))->assertUnprocessable();
        $this->postJson(route('api.v1.loans.retry-disbursement', $loan))->assertUnprocessable();

        $loan->refresh();
        $this->assertSame(LoanStatus::Escalated, $loan->status);
        $this->assertSame(3, $loan->disbursement_attempts);
        $this->assertSame(3, LoanDisbursement::where('loan_id', $loan->id)->distinct()->count('batch_id'));
        $this->assertSame(2, AuditLog::where('auditable_id', $loan->id)->where('action', 'RETRY_DISBURSEMENT')->count());
        $this->assertEquals(0, app(Ledger::class)->balance($loan->company_id, Account::LoanReceivable, $loan->branch_id));
        $this->postJson(route('api.v1.loans.retry-disbursement', $loan))->assertUnprocessable();

        $this->postJson(route('api.v1.loans.escalation', $loan), ['action' => 'suspense', 'reason' => 'Low float'])->assertOk();
        $this->assertSame(LoanStatus::DisbursementSuspense, $loan->fresh()->status);
    }

    public function test_escalated_loan_can_be_paid_in_cash_with_withdrawal_code(): void
    {
        config(['integrations.vodacom.test_outcome' => 'failed', 'integrations.vodacom.max_disbursement_attempts' => 1]);
        $loan = $this->toFinance();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.disburse', $loan))->assertUnprocessable();
        $this->assertSame(LoanStatus::Escalated, $loan->fresh()->status);

        $this->postJson(route('api.v1.loans.escalation', $loan), ['action' => 'other_channel', 'reason' => 'Vodacom down'])->assertJsonValidationErrors('channel');
        $this->postJson(route('api.v1.loans.escalation', $loan), ['action' => 'other_channel', 'channel' => 'cash', 'reason' => 'Vodacom down'])->assertOk();

        $loan->refresh();
        $this->postJson(route('api.v1.loans.cash-out', $loan), ['code' => '0000'])->assertJsonValidationErrors('code');
        $this->postJson(route('api.v1.loans.cash-out', $loan), ['code' => $loan->withdrawal_code])->assertOk();
        $this->assertSame(LoanStatus::Active, $loan->fresh()->status);
        $this->assertSame('cash', $loan->fresh()->disbursement_channel);
    }

    public function test_vodacom_callback_is_signed_and_idempotent(): void
    {
        config(['integrations.vodacom.test_outcome' => 'callback', 'integrations.vodacom.callback_secret' => 'secret']);
        $loan = $this->toFinance();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.disburse', $loan))->assertOk();
        $this->assertSame(LoanStatus::AwaitingDisbursement, $loan->fresh()->status);

        $batch = $loan->latestDisbursement()->value('batch_id');
        $body = json_encode(['batch_id' => $batch, 'status' => 'SUCCESS', 'transaction_id' => 'MP123']);

        $this->call('POST', '/api/webhooks/vodacom/disbursement-status', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_X_SIGNATURE' => 'bad'], $body)->assertUnauthorized();
        $this->assertSame(LoanStatus::AwaitingDisbursement, $loan->fresh()->status);

        $headers = ['CONTENT_TYPE' => 'application/json', 'HTTP_X_SIGNATURE' => hash_hmac('sha256', $body, 'secret')];
        $this->call('POST', '/api/webhooks/vodacom/disbursement-status', [], [], [], $headers, $body)->assertOk()->assertJsonPath('status', 'PROCESSED');
        $this->call('POST', '/api/webhooks/vodacom/disbursement-status', [], [], [], $headers, $body)->assertOk()->assertJsonPath('status', 'ALREADY_PROCESSED');

        $this->assertSame(LoanStatus::Active, $loan->fresh()->status);
        $this->assertSame(1, $loan->transactions()->where('type', 'withdrawal')->count());
    }

    public function test_overdue_processing_penalty_dpd_closure_and_freeze(): void
    {
        $this->travelTo('2026-09-10 10:00:00');
        $this->admin->company->update(['penalty_type' => 'percentage', 'penalty_value' => 10]);
        $this->category->update(['freeze_time_days' => 30]);
        $loan = $this->toActive();
        $loan->schedules()->update(['due_date' => today()->subDays(3)]);
        $loan->update(['end_date' => today()->addDays(10)]);

        $this->artisan('loans:process-overdue')->assertSuccessful();
        $loan->refresh();
        $this->assertSame(LoanStatus::Overdue, $loan->status);
        $this->assertSame(3, $loan->days_past_due);
        $this->assertDatabaseHas('penalties', ['loan_id' => $loan->id, 'amount' => 13000]);

        app(LoanService::class)->deposit($loan, 143000, now()->toImmutable());
        $loan->refresh();
        $this->assertSame(LoanStatus::Closed, $loan->status);
        // Settled (penalty included) before the 2026-09-20 maturity: early settlement, frozen from disbursement (10:00).
        $this->assertTrue($loan->early_settlement);
        $this->assertSame('2026-09-10 10:00:00', $loan->freeze_started_at->toDateTimeString());
        $this->assertSame('2026-10-10 10:00:00', $loan->frozen_until->toDateTimeString());

        $this->postJson(route('api.v1.loans.store'), $this->form())
            ->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'Customer fully settled the previous loan early. Re-borrowing is frozen until 10 October 2026.');
    }

    public function test_top_up_requires_paid_percentage_and_settles_previous_loan(): void
    {
        $old = $this->toActive();

        $this->postJson(route('api.v1.loans.store'), $this->form())->assertUnprocessable()
            ->assertJsonPath('errors.customer_id.0', 'NOT ELIGIBLE for top-up: paid 0% of required 50%');

        app(LoanService::class)->deposit($old, 70000, now()->toImmutable());
        $this->postJson(route('api.v1.loans.store'), $this->form(['how_loan' => 200000]))->assertCreated();
        $new = Loan::latest('id')->first();
        $this->assertSame($old->id, $new->topup_of_loan_id);

        $this->postJson(route('api.v1.loans.approve-manager', $new), ['loan_aprove' => 200000])->assertOk();
        $this->postJson(route('api.v1.loans.kyc-verify', $new))->assertOk();
        $this->postJson(route('api.v1.loans.approve-credit', $new))->assertOk();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $new))->assertOk();
        $this->postJson(route('api.v1.loans.disburse', $new))->assertOk();

        $this->assertSame(LoanStatus::Closed, $old->fresh()->status);
        $this->assertSame(LoanStatus::Active, $new->fresh()->status);
        $this->assertDatabaseHas('loan_disbursements', ['loan_id' => $new->id, 'amount' => 135000]);
    }

    public function test_preview_categories_and_withdrawal_report(): void
    {
        $this->postJson(route('api.v1.loans.preview'), ['category_id' => $this->category->id, 'how_loan' => '100,000', 'session' => 2, 'rate' => 'SIMPLE', 'fee_status' => 'YES'])
            ->assertOk()->assertJsonPath('data.total', 130000)->assertJsonPath('data.restoration', 65000)->assertJsonPath('data.take_home', 95000);

        $this->getJson(route('api.v1.loans.categories', $this->customer))->assertOk()
            ->assertJsonPath('data.0.label', 'WAJASILIAMALI / 20000 - 2000000')
            ->assertJsonPath('eligibility.allowed', true);

        $loan = $this->toActive();
        $this->getJson(route('api.v1.loans.withdrawals'))->assertOk()->assertJsonPath('data.0.id', $loan->id);
        $this->getJson(route('api.v1.loans.withdrawals', ['loan_status' => 'DONE']))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_only_unapproved_loans_can_be_deleted(): void
    {
        $loan = $this->toFinance();
        $this->deleteJson(route('api.v1.loans.destroy', $loan))->assertUnprocessable();

        $loan->update(['status' => LoanStatus::Rejected]);
        $this->deleteJson(route('api.v1.loans.destroy', $loan))->assertOk();
        $this->assertModelMissing($loan);
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

    private function applyLoan(): Loan
    {
        $this->postJson(route('api.v1.loans.store'), $this->form())->assertCreated();

        return Loan::latest('id')->firstOrFail();
    }

    private function toCreditReview(): Loan
    {
        $loan = $this->applyLoan();
        $this->postJson(route('api.v1.loans.approve-manager', $loan), ['loan_aprove' => 100000])->assertOk();

        return $loan->fresh();
    }

    private function toFinance(): Loan
    {
        $loan = $this->toCreditReview();
        $this->postJson(route('api.v1.loans.kyc-verify', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.approve-credit', $loan))->assertOk();

        return $loan->fresh();
    }

    private function toActive(): Loan
    {
        $loan = $this->toFinance();
        $this->postJson(route('api.v1.loans.prepare-disbursement', $loan))->assertOk();
        $this->postJson(route('api.v1.loans.disburse', $loan))->assertOk();

        return $loan->fresh();
    }

    private function employee(string $role, int $branchId): Employee
    {
        return Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $branchId,
            'role_id' => $this->admin->company->roles()->where('key', $role)->value('id'),
        ]);
    }
}
