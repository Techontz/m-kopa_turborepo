<?php

namespace Tests\Feature\SalaryAdvance;

use App\Enums\Account;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\LedgerEntry;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceCategory;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalaryAdvanceTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private SalaryAdvanceCategory $category;

    private Customer $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->category = SalaryAdvanceCategory::create([
            'company_id' => $this->admin->company_id,
            'name' => 'WATUMISHI',
            'interest_rate' => 20,
            'amount_from' => 10000,
            'amount_to' => 30000,
            'fee' => 200,
        ]);
        $this->customer = Customer::factory()->create(['branch_id' => $this->admin->branch_id, 'work_status' => 'ent']);
    }

    public function test_category_page_lists_categories(): void
    {
        $this->get(route('salary-advance-categories.index'))
            ->assertOk()
            ->assertSee('Salary advance Category List')
            ->assertSee('WATUMISHI');
    }

    public function test_admin_can_create_update_and_delete_a_category(): void
    {
        $this->post(route('salary-advance-categories.store'), [
            'perferal_name' => 'WAJASIRIAMALI',
            'interest_name' => 15,
            'from_amount' => 5000,
            'to_amount' => 50000,
            'fee_charger' => 500,
        ])->assertRedirect();

        $category = SalaryAdvanceCategory::where('name', 'WAJASIRIAMALI')->firstOrFail();
        $this->assertSame($this->admin->company_id, $category->company_id);

        $this->put(route('salary-advance-categories.update', $category), [
            'perferal_name' => 'WAJASIRIAMALI',
            'interest_name' => 25,
            'from_amount' => 5000,
            'to_amount' => 60000,
            'fee_charger' => 500,
        ])->assertRedirect();
        $this->assertEquals(25, $category->fresh()->interest_rate);

        $this->delete(route('salary-advance-categories.destroy', $category))->assertRedirect();
        $this->assertModelMissing($category);
    }

    public function test_salary_advance_pages_render(): void
    {
        foreach ([
            'salary-advances.requested' => 'Request Loan',
            'salary-advances.approved' => 'Salary Advance Aproved Today',
            'salary-advances.active' => 'Salary advance Loan',
            'salary-advances.repayments' => 'Salary Advance Loan',
            'salary-advances.paid' => 'Salary Advance Paid List',
        ] as $route => $label) {
            $this->get(route($route))->assertOk()->assertSee($label);
        }
    }

    public function test_request_is_created_with_interest_and_fee(): void
    {
        $this->post(route('salary-advances.store'), [
            'blanch_id' => $this->admin->branch_id,
            'customer_id' => $this->customer->id,
            'per_id' => $this->category->id,
            'loan_amount' => 20000,
        ])->assertRedirect();

        $this->assertDatabaseHas('salary_advances', [
            'customer_id' => $this->customer->id,
            'amount' => 20000,
            'total_payable' => 24000,
            'fee' => 200,
            'status' => 'pending',
        ]);

        $this->get(route('salary-advances.requested'))->assertSee('24,000');
    }

    public function test_request_outside_category_range_is_rejected(): void
    {
        $this->post(route('salary-advances.store'), [
            'blanch_id' => $this->admin->branch_id,
            'customer_id' => $this->customer->id,
            'per_id' => $this->category->id,
            'loan_amount' => 90000,
        ])->assertSessionHas('error');

        $this->assertDatabaseCount('salary_advances', 0);
    }

    public function test_approve_and_full_repayment_post_ledger_entries(): void
    {
        $advance = $this->pendingAdvance();
        $ledger = app(Ledger::class);

        $this->post(route('salary-advances.approve', $advance))->assertRedirect();

        $advance->refresh();
        $this->assertSame('active', $advance->status);
        $this->assertNotNull($advance->approved_at);
        $this->assertEquals(-20000, $ledger->balance($this->admin->company_id, Account::HqSalaryAdvance));
        $this->assertEquals(200, $ledger->balance($this->admin->company_id, Account::LoanFee, $this->admin->branch_id));

        $this->get(route('salary-advances.approved'))->assertSee($this->customer->full_name);
        $this->get(route('salary-advances.active'))->assertSee($this->customer->full_name);

        $this->post(route('salary-advances.pay', $advance), ['amount' => 30000])->assertSessionHas('error');

        $this->post(route('salary-advances.pay', $advance), ['amount' => 10000])->assertRedirect();
        $this->assertSame('active', $advance->fresh()->status);

        $this->post(route('salary-advances.pay', $advance), ['amount' => 14000])->assertRedirect();
        $this->assertSame('done', $advance->fresh()->status);
        $this->assertEquals(4000, $ledger->balance($this->admin->company_id, Account::HqSalaryAdvance));

        $this->get(route('salary-advances.paid'))->assertSee('14,000');
        $this->get(route('salary-advances.repayments'))->assertSee('DONE');
    }

    public function test_pending_request_can_be_deleted_without_ledger_effect(): void
    {
        $advance = $this->pendingAdvance();

        $this->delete(route('salary-advances.destroy', $advance))->assertRedirect();

        $this->assertModelMissing($advance);
        $this->assertSame(0, LedgerEntry::count());
    }

    public function test_advances_of_other_companies_are_not_reachable(): void
    {
        $foreignCustomer = Customer::factory()->create();
        $foreignCategory = SalaryAdvanceCategory::create([
            'company_id' => $foreignCustomer->company_id,
            'name' => 'OTHER',
            'interest_rate' => 10,
            'amount_from' => 1000,
            'amount_to' => 5000,
        ]);
        $foreign = SalaryAdvance::create([
            'company_id' => $foreignCustomer->company_id,
            'branch_id' => $foreignCustomer->branch_id,
            'customer_id' => $foreignCustomer->id,
            'salary_advance_category_id' => $foreignCategory->id,
            'amount' => 2000,
            'interest_rate' => 10,
            'total_payable' => 2200,
        ]);

        $this->post(route('salary-advances.approve', $foreign))->assertNotFound();
        $this->delete(route('salary-advance-categories.destroy', $foreignCategory))->assertNotFound();
        $this->assertSame('pending', $foreign->fresh()->status);
    }

    private function pendingAdvance(): SalaryAdvance
    {
        return SalaryAdvance::create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'customer_id' => $this->customer->id,
            'salary_advance_category_id' => $this->category->id,
            'amount' => 20000,
            'interest_rate' => 20,
            'total_payable' => 24000,
            'fee' => 200,
        ]);
    }
}
