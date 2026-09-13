<?php

namespace Tests\Feature\Settings;

use App\Enums\Account;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoanFeeTest extends TestCase
{
    use RefreshDatabase;

    public function test_loan_fee_page_lists_product_fees(): void
    {
        $admin = $this->signInAdmin();
        LoanCategory::factory()->create(['company_id' => $admin->company_id, 'name' => 'GROUP LOAN', 'fee_value' => 75000, 'insurance' => 100000]);

        $this->get(route('loan-fees.index'))
            ->assertOk()
            ->assertSee('Add Loan Fee Category')
            ->assertSee('LOAN FEE BY LOAN PRODUCT')
            ->assertSee('GROUP LOAN')
            ->assertSee('75,000 / Tsh')
            ->assertSee('MONEY VALUE');
    }

    public function test_admin_can_change_loan_fee_mode(): void
    {
        $admin = $this->signInAdmin();

        $this->put(route('loan-fees.mode'), ['fee_category' => 'GENERAL'])->assertRedirect();

        $this->assertSame('general', $admin->company->fresh()->loan_fee_mode);
    }

    public function test_admin_can_update_category_fee(): void
    {
        $admin = $this->signInAdmin();
        $category = LoanCategory::factory()->create(['company_id' => $admin->company_id]);

        $this->put(route('loan-fees.update', $category), [
            'loan_name' => 'WAJASILIAMALI',
            'loan_price' => 20000,
            'loan_perday' => 2000000,
            'interest_formular' => 25,
            'fee_category_type' => 'PERCENTAGE',
            'fee_value' => 3,
            'insurance' => 1500,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $category->refresh();
        $this->assertSame('percentage', $category->fee_type);
        $this->assertSame(3.0, (float) $category->fee_value);
        $this->assertSame(1500.0, (float) $category->insurance);
        $this->assertSame(25.0, (float) $category->interest_rate);
    }

    public function test_deducted_income_lists_loan_fee_ledger_entries(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'first_name' => 'HABAKUKI']);
        $loan = Loan::factory()->create(['customer_id' => $customer->id, 'amount_approved' => 600000]);
        app(Ledger::class)->post($admin->company_id, Account::LoanFee, 7500, 'LOAN FEE', $admin->branch_id, $loan);

        $this->get(route('loan-fees.income'))
            ->assertOk()
            ->assertSee('Filter Loan Fee')
            ->assertSee('HABAKUKI')
            ->assertSee('600,000')
            ->assertSee('7,500');

        $this->get(route('loan-fees.income', ['blanch_id' => 'all', 'from' => now()->subYear()->toDateString(), 'to' => now()->subMonth()->toDateString()]))
            ->assertOk()
            ->assertDontSee('7,500');
    }

    public function test_loan_fee_of_other_company_category_cannot_be_updated(): void
    {
        $this->signInAdmin();
        $foreign = LoanCategory::factory()->create(['fee_value' => 5000]);

        $this->put(route('loan-fees.update', $foreign), [
            'loan_name' => 'X', 'loan_price' => 1, 'loan_perday' => 2, 'interest_formular' => 1,
            'fee_category_type' => 'MONEY', 'fee_value' => 1, 'insurance' => 0,
        ])->assertNotFound();

        $this->assertSame(5000.0, (float) $foreign->fresh()->fee_value);
    }
}
