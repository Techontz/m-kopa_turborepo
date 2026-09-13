<?php

namespace Tests\Feature\Api\SalaryAdvance;

use App\Enums\Account;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceCategory;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalaryAdvanceApiTest extends TestCase
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

    public function test_category_crud(): void
    {
        $this->getJson('/api/v1/salary-advance/categories')->assertOk()->assertJsonPath('data.0.name', 'WATUMISHI')->assertJsonPath('data.0.interest_rate', 20);

        $id = $this->postJson('/api/v1/salary-advance/categories', [
            'perferal_name' => 'WAJASIRIAMALI', 'interest_name' => 15, 'from_amount' => 5000, 'to_amount' => 50000, 'fee_charger' => 500,
        ])->assertCreated()->assertJsonPath('message', 'Salary advance Category Registered successfully')->json('data.id');

        $this->putJson("/api/v1/salary-advance/categories/{$id}", [
            'perferal_name' => 'WAJASIRIAMALI', 'interest_name' => 25, 'from_amount' => 5000, 'to_amount' => 60000, 'fee_charger' => 500,
        ])->assertOk()->assertJsonPath('data.interest_rate', 25);

        $this->deleteJson("/api/v1/salary-advance/categories/{$id}")->assertOk()->assertJsonPath('message', 'Salary advance Category Deleted successfully');
        $this->assertDatabaseMissing('salary_advance_categories', ['id' => $id]);
    }

    public function test_category_validation_and_protected_delete(): void
    {
        $this->postJson('/api/v1/salary-advance/categories', ['perferal_name' => '', 'from_amount' => 5000, 'to_amount' => 100])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['perferal_name', 'interest_name', 'to_amount', 'fee_charger']);

        $this->pendingAdvance();
        $this->deleteJson("/api/v1/salary-advance/categories/{$this->category->id}")->assertUnprocessable();
    }

    public function test_request_creates_pending_advance_with_interest_and_fee(): void
    {
        $this->postJson('/api/v1/salary-advance/advances', [
            'blanch_id' => $this->admin->branch_id,
            'customer_id' => $this->customer->id,
            'per_id' => $this->category->id,
            'loan_amount' => 20000,
        ])->assertCreated()->assertJsonPath('message', 'Salary Advance Requested successfully');

        $this->assertDatabaseHas('salary_advances', ['customer_id' => $this->customer->id, 'amount' => 20000, 'total_payable' => 24000, 'fee' => 200, 'status' => 'pending', 'employee_id' => $this->admin->id]);

        $this->getJson('/api/v1/salary-advance/requested')
            ->assertOk()
            ->assertJsonPath('data.0.total_payable', 24000)
            ->assertJsonPath('data.0.remaining_amount', 24000)
            ->assertJsonPath('data.0.customer', $this->customer->full_name);
    }

    public function test_request_validation_and_category_range(): void
    {
        $this->postJson('/api/v1/salary-advance/advances', [])->assertUnprocessable()
            ->assertJsonValidationErrors(['blanch_id' => 'Please select branch', 'customer_id', 'per_id', 'loan_amount']);

        $this->postJson('/api/v1/salary-advance/advances', [
            'blanch_id' => $this->admin->branch_id, 'customer_id' => $this->customer->id, 'per_id' => $this->category->id, 'loan_amount' => 90000,
        ])->assertUnprocessable()->assertJsonValidationErrors(['loan_amount' => 'Loan amount must be between 10,000 - 30,000']);

        $this->assertDatabaseCount('salary_advances', 0);
    }

    public function test_approve_repay_and_paid_list_post_ledger_entries(): void
    {
        $advance = $this->pendingAdvance();
        $ledger = app(Ledger::class);
        $company = $this->admin->company_id;
        $branch = $this->admin->branch_id;

        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/approve")->assertOk()->assertJsonPath('message', 'Salary Advance Approved successfully');
        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/approve")->assertUnprocessable();

        $this->assertSame('active', $advance->fresh()->status);
        $this->assertEquals(-20000, $ledger->balance($company, Account::HqSalaryAdvance));
        $this->assertEquals(20000, $ledger->balance($company, Account::SalaryAdvanceReceivable, $branch));
        $this->assertEquals(200, $ledger->balance($company, Account::LoanFee, $branch));
        $this->assertEquals(200, $ledger->balance($company, Account::FeeIncome, $branch));

        $this->getJson('/api/v1/salary-advance/approved')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/salary-advance/active')->assertOk()->assertJsonPath('data.0.id', $advance->id)->assertJsonPath('data.0.alert', 'new');

        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/payments", ['amount' => 30000])
            ->assertUnprocessable()->assertJsonValidationErrors(['amount' => 'Amount is greater than remain amount (24,000)']);

        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/payments", ['amount' => 10000])->assertOk()->assertJsonPath('message', 'Deposit successfully');
        $this->assertEquals(10000, $ledger->balance($company, Account::SalaryAdvanceReceivable, $branch), 'Principal is recovered first');
        $this->assertEquals(0, $ledger->balance($company, Account::InterestIncome, $branch));

        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/payments", ['amount' => 14000])->assertOk();
        $this->assertSame('done', $advance->fresh()->status);
        $this->assertEquals(4000, $ledger->balance($company, Account::HqSalaryAdvance));
        $this->assertEquals(0, $ledger->balance($company, Account::SalaryAdvanceReceivable, $branch));
        $this->assertEquals(4000, $ledger->balance($company, Account::InterestIncome, $branch));

        $this->getJson('/api/v1/salary-advance/paid')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.amount', 14000);
        $this->getJson('/api/v1/salary-advance/paid?branch_id=all&from=2000-01-01&to=2000-01-02')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/salary-advance/repayments')->assertOk()->assertJsonPath('data.0.status', 'done')->assertJsonCount(2, 'data.0.payments');
        $this->getJson('/api/v1/salary-advance/active')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_pending_request_is_deleted_without_ledger_effect(): void
    {
        $advance = $this->pendingAdvance();

        $this->deleteJson("/api/v1/salary-advance/advances/{$advance->id}")->assertOk()->assertJsonPath('message', 'Salary Advance Deleted successfully');

        $this->assertModelMissing($advance);
        $this->assertSame(0, JournalEntry::count());
    }

    public function test_approved_advance_is_reversed_not_deleted(): void
    {
        $advance = $this->pendingAdvance();
        $ledger = app(Ledger::class);
        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/approve")->assertOk();
        $this->postJson("/api/v1/salary-advance/advances/{$advance->id}/payments", ['amount' => 5000])->assertOk();

        $this->deleteJson("/api/v1/salary-advance/advances/{$advance->id}")->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->deleteJson("/api/v1/salary-advance/advances/{$advance->id}", ['reason' => 'Wrong customer'])->assertOk()->assertJsonPath('message', 'Salary Advance Reversed successfully');

        $advance->refresh();
        $this->assertSame('reversed', $advance->status);
        $this->assertNotNull($advance->reversed_at);
        $this->assertSame(2, JournalEntry::whereNotNull('reversal_of_id')->count());
        $this->assertEquals(0, $ledger->balance($this->admin->company_id, Account::HqSalaryAdvance));
        $this->assertEquals(0, $ledger->balance($this->admin->company_id, Account::SalaryAdvanceReceivable, $this->admin->branch_id));
        $this->assertEquals(0, $ledger->balance($this->admin->company_id, Account::FeeIncome, $this->admin->branch_id));
        $this->assertTrue(AuditLog::where('action', 'SalaryAdvance.updated')->where('auditable_id', $advance->id)->exists());
        $this->getJson('/api/v1/salary-advance/paid')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_role_without_permission_is_forbidden(): void
    {
        $teller = Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'role_id' => $this->admin->company->roles()->where('key', 'teller')->value('id'),
        ]);
        $this->actingAs($teller);

        $this->getJson('/api/v1/salary-advance/requested')->assertForbidden();
        $this->postJson('/api/v1/salary-advance/categories', [])->assertForbidden();
        $this->postJson("/api/v1/salary-advance/advances/{$this->pendingAdvance()->id}/approve")->assertForbidden();
    }

    public function test_branch_scope_and_company_isolation(): void
    {
        $otherBranch = Branch::factory()->create(['company_id' => $this->admin->company_id]);
        $otherCustomer = Customer::factory()->create(['branch_id' => $otherBranch->id]);
        $this->pendingAdvance();
        $foreignAdvance = $this->pendingAdvance($otherCustomer);

        $finance = Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'role_id' => $this->admin->company->roles()->where('key', 'branch_manager')->value('id'),
        ]);
        $finance->role->permissions()->create(['permission' => 'salary_advance.manage']);
        $this->actingAs($finance->fresh());

        $this->getJson('/api/v1/salary-advance/requested')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/salary-advance/advances/{$foreignAdvance->id}/approve")->assertForbidden();
        $this->postJson('/api/v1/salary-advance/advances', [
            'blanch_id' => $otherBranch->id, 'customer_id' => $otherCustomer->id, 'per_id' => $this->category->id, 'loan_amount' => 20000,
        ])->assertForbidden();

        $this->actingAs($this->admin);
        $otherCompanyCustomer = Customer::factory()->create();
        $otherCompanyCategory = SalaryAdvanceCategory::create(['company_id' => $otherCompanyCustomer->company_id, 'name' => 'OTHER', 'interest_rate' => 10, 'amount_from' => 1000, 'amount_to' => 5000]);
        $this->deleteJson("/api/v1/salary-advance/categories/{$otherCompanyCategory->id}")->assertNotFound();
    }

    private function pendingAdvance(?Customer $customer = null): SalaryAdvance
    {
        $customer ??= $this->customer;

        return SalaryAdvance::create([
            'company_id' => $customer->company_id,
            'branch_id' => $customer->branch_id,
            'customer_id' => $customer->id,
            'salary_advance_category_id' => $this->category->id,
            'amount' => 20000,
            'interest_rate' => 20,
            'total_payable' => 24000,
            'fee' => 200,
        ]);
    }
}
