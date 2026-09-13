<?php

namespace Tests\Feature\Loans;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoanLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private Customer $customer;

    private LoanCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->customer = Customer::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id]);
        $this->category = LoanCategory::factory()->create(['company_id' => $this->admin->company_id, 'insurance' => 0]);
        $this->category->branches()->attach($this->admin->branch_id);
        $this->admin->company->update(['reserve_percent' => 20]);
        app(Ledger::class)->openingBalance($this->admin->company_id, Account::Principal, 1000000, 'FLOAT', $this->admin->branch_id);
    }

    public function test_full_loan_lifecycle_from_application_to_repayment(): void
    {
        $this->get(route('loans.form', $this->customer))->assertOk()->assertSee('Loan Application Form')->assertSee('WAJASILIAMALI / 20000 - 2000000');

        $this->post(route('loans.store', $this->customer), [
            'category_id' => $this->category->id, 'how_loan' => 100000, 'day' => 'weekly',
            'session' => 1, 'rate' => 'SIMPLE', 'fee_status' => 'YES', 'reason' => 'BIASHARA',
        ])->assertRedirect();

        $loan = $this->customer->loans()->firstOrFail();
        $this->assertSame(LoanStatus::PendingManagerApproval, $loan->status);
        $this->assertEquals(130000, $loan->total_payable);
        $this->assertEquals(130000, $loan->restoration);

        $this->get(route('loans.pending'))->assertOk()->assertSee($loan->loan_number);
        $this->get(route('loans.show', $loan))->assertOk()->assertSee('Applied Loan Application Form');

        $this->post(route('loans.approve', $loan), ['loan_aprove' => 100000])->assertRedirect(route('loans.disbursed'));
        $loan->refresh();
        $this->assertSame(LoanStatus::AwaitingDisbursement, $loan->status);
        $this->assertNotNull($loan->withdrawal_code);
        $this->assertDatabaseHas('sms_logs', ['customer_id' => $this->customer->id]);

        $this->post(route('teller.withdraw', $loan), ['method' => 'CASH', 'code' => '0000'])->assertSessionHas('error', 'Invalid withdrawal code');
        $this->post(route('teller.withdraw', $loan), ['method' => 'CASH', 'code' => $loan->withdrawal_code])->assertSessionHas('success');

        $loan->refresh();
        $ledger = app(Ledger::class);
        $this->assertSame(LoanStatus::Active, $loan->status);
        $this->assertCount(1, $loan->schedules);
        $this->assertEquals(900000, $ledger->balance($loan->company_id, Account::Principal, $loan->branch_id));
        $this->assertEquals(5000, $ledger->balance($loan->company_id, Account::LoanFee, $loan->branch_id));

        $this->get(route('teller.show', $this->customer))->assertOk()->assertSee('Customer Loan Information');
        $this->post(route('teller.deposit', $loan), ['depost' => '130,000', 'p_method' => 'CASH'])->assertSessionHas('success');

        $loan->refresh();
        $this->assertSame(LoanStatus::Closed, $loan->status);
        $this->assertSame('close', $this->customer->fresh()->status);
        $this->assertEquals(1000000, $ledger->balance($loan->company_id, Account::Principal, $loan->branch_id));
        $this->assertEquals(24000, $ledger->balance($loan->company_id, Account::Interest, $loan->branch_id));
        $this->assertEquals(6000, $ledger->balance($loan->company_id, Account::Reserve, $loan->branch_id));
    }

    public function test_loan_cannot_be_approved_before_kyc(): void
    {
        $this->customer->update(['kyc_status' => 'pending']);
        $loan = Loan::factory()->create(['customer_id' => $this->customer->id, 'loan_category_id' => $this->category->id]);

        $this->post(route('loans.approve', $loan), ['loan_aprove' => 100000])
            ->assertSessionHas('error', 'Please wait for the customer`s KYC to be Verfied!');
        $this->assertSame(LoanStatus::PendingManagerApproval, $loan->fresh()->status);
    }

    public function test_loan_amount_must_be_within_category_range(): void
    {
        $this->post(route('loans.store', $this->customer), [
            'category_id' => $this->category->id, 'how_loan' => 5000, 'day' => 'weekly',
            'session' => 1, 'rate' => 'SIMPLE', 'fee_status' => 'YES', 'reason' => 'BIASHARA',
        ])->assertSessionHasErrors('amount_applied');
    }

    public function test_loan_list_pages_render(): void
    {
        foreach (['loans.application', 'loans.disbursed', 'loans.withdrawal', 'loans.rejected', 'loans.special', 'teller.index'] as $route) {
            $this->get(route($route))->assertOk();
        }
    }
}
