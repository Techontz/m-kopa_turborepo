<?php

namespace Tests\Feature\Loans;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\Penalty;
use App\Services\Ledger;
use App\Services\LoanService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Business rule: repayments are allocated Principal → Penalty → Interest.
 */
class RepaymentAllocationTest extends TestCase
{
    use RefreshDatabase;

    private Loan $loan;

    protected function setUp(): void
    {
        parent::setUp();

        $admin = $this->signInAdmin();
        $admin->company->update(['reserve_percent' => 20]);
        $customer = Customer::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);
        $category = LoanCategory::factory()->create(['company_id' => $admin->company_id, 'insurance' => 0, 'fee_value' => 0]);
        app(Ledger::class)->openingBalance($admin->company_id, Account::Principal, 1000000, 'FLOAT', $admin->branch_id);

        $loans = app(LoanService::class);
        $loan = $loans->apply($customer, ['loan_category_id' => $category->id, 'amount_applied' => 100000, 'sessions' => 1, 'formula' => 'SIMPLE', 'fee_deduct' => false, 'reason' => 'BIASHARA']);
        $loans->approve($loan, 100000);
        $loans->withdraw($loan->fresh(), CarbonImmutable::today()->subDays(10));

        Penalty::create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'customer_id' => $customer->id, 'loan_id' => $loan->id, 'amount' => 10000, 'penalty_date' => today()->subDays(2)]);

        $this->loan = $loan->fresh();
    }

    public function test_payment_covers_principal_before_penalty_and_interest(): void
    {
        $transaction = app(LoanService::class)->deposit($this->loan, 105000, CarbonImmutable::today());

        $this->assertEquals(100000, $transaction->principal);
        $this->assertEquals(5000, $transaction->penalty);
        $this->assertEquals(0, $transaction->interest);

        $outstanding = app(LoanService::class)->outstanding($this->loan->fresh());
        $this->assertSame(0.0, $outstanding['principal']);
        $this->assertSame(5000.0, $outstanding['penalty']);
        $this->assertSame(30000.0, $outstanding['interest']);
        $this->assertSame(35000.0, $this->loan->fresh()->remaining_amount);
    }

    public function test_interest_is_collected_last_and_reserve_is_cut_from_it(): void
    {
        $loans = app(LoanService::class);
        $ledger = app(Ledger::class);
        $loans->deposit($this->loan, 110000, CarbonImmutable::today());
        $transaction = $loans->deposit($this->loan->fresh(), 30000, CarbonImmutable::today());

        $this->assertEquals(0, $transaction->principal);
        $this->assertEquals(0, $transaction->penalty);
        $this->assertEquals(30000, $transaction->interest);
        $this->assertEquals(6000, $transaction->reserve);
        $this->assertSame(LoanStatus::Closed, $this->loan->fresh()->status);

        $branch = $this->loan->branch_id;
        $this->assertSame(0.0, $ledger->balance($this->loan->company_id, Account::LoanReceivable, $branch));
        $this->assertSame(10000.0, $ledger->balance($this->loan->company_id, Account::PenaltyIncome, $branch));
        $this->assertSame(24000.0, $ledger->balance($this->loan->company_id, Account::InterestIncome, $branch), 'D6: interest income is net of the reserve');
        $this->assertSame(6000.0, $ledger->balance($this->loan->company_id, Account::InterestReserve, $branch));
        $this->assertSame(6000.0, $ledger->balance($this->loan->company_id, Account::Reserve, $branch));
        $this->assertSame(24000.0, $ledger->balance($this->loan->company_id, Account::Interest, $branch));
    }

    public function test_overpayment_is_refused(): void
    {
        $this->expectException(ValidationException::class);

        app(LoanService::class)->deposit($this->loan, 150000, CarbonImmutable::today());
    }
}
