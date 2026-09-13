<?php

namespace Tests\Feature\Api\Customers;

use App\Models\Branch;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Guarantor;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\Region;
use App\Models\SmsLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_customer_list_filters_by_branch_and_live_status(): void
    {
        $admin = $this->signInAdmin();
        $other = Branch::factory()->create(['company_id' => $admin->company_id]);
        $active = Customer::factory()->create(['branch_id' => $admin->branch_id, 'status' => 'open']);
        $closed = Customer::factory()->create(['branch_id' => $other->id, 'status' => 'close']);
        Customer::factory()->create();

        $this->getJson('/api/v1/customers')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/customers?branch_id=all&customer_status=CLOSED')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $closed->id)
            ->assertJsonPath('data.0.status_label', 'DONE');
        $this->getJson("/api/v1/customers?branch_id={$admin->branch_id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.customer_code', $active->customer_code);
    }

    public function test_branch_roles_only_reach_customers_of_their_branch(): void
    {
        $admin = $this->signInAdmin();
        $other = Branch::factory()->create(['company_id' => $admin->company_id]);
        $mine = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $foreign = Customer::factory()->create(['branch_id' => $other->id]);

        $this->actingAs($this->employeeWithRole($admin, 'loan_officer'));

        $this->getJson('/api/v1/customers')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine->id);
        $this->getJson("/api/v1/customers/{$foreign->id}")->assertNotFound();
        $this->getJson("/api/v1/customers/{$mine->id}")->assertOk()->assertJsonPath('data.kyc.state', 'legacy');
        $this->deleteJson("/api/v1/customers/{$foreign->id}")->assertNotFound();

        $this->actingAs($this->employeeWithRole($admin, 'hr'));
        $this->getJson('/api/v1/customers')->assertForbidden();
    }

    public function test_legacy_profile_basic_update_mark_sms_and_manual_kyc_approval(): void
    {
        $admin = $this->signInAdmin();
        $region = Region::create(['name' => 'Mwanza']);
        $customer = Customer::factory()->incomplete()->create(['branch_id' => $admin->branch_id]);

        $this->putJson("/api/v1/customers/{$customer->id}", ['blanch_id' => $admin->branch_id, 'empl_id' => $admin->id])
            ->assertUnprocessable()->assertJsonValidationErrors(['f_name', 'region_id']);

        $this->putJson("/api/v1/customers/{$customer->id}", [
            'f_name' => 'Asha', 'm_name' => 'Juma', 'l_name' => 'Hamisi', 'blanch_id' => $admin->branch_id, 'empl_id' => $admin->id,
            'gender' => 'female', 'date_birth' => '1995-04-10', 'phone_no' => '0754123456', 'region_id' => $region->id,
            'district' => 'Ilemela', 'ward' => 'Buswelu', 'street' => 'Mtaa A',
        ])->assertOk()->assertJsonPath('message', 'Customer information updated successfully');
        $this->assertSame('255754123456', $customer->fresh()->phone);

        $this->postJson("/api/v1/customers/{$customer->id}/mark")->assertOk()->assertJsonPath('message', 'Customer Marked successfully');
        $this->assertTrue($customer->fresh()->is_marked);

        $this->postJson("/api/v1/customers/{$customer->id}/sms", ['message' => 'Habari'])->assertOk();
        $this->assertSame(1, SmsLog::where('customer_id', $customer->id)->count());

        $this->getJson("/api/v1/customers/{$customer->id}/eligibility")->assertOk()->assertJsonPath('data.kyc_complete', false);
        $this->postJson("/api/v1/customers/{$customer->id}/kyc/approve")->assertOk()->assertJsonPath('message', 'Customer KYC Aproved successfully');
        $this->getJson("/api/v1/customers/{$customer->id}/eligibility")->assertOk()->assertJsonPath('data.kyc_complete', true)->assertJsonPath('data.eligible', true);
    }

    public function test_manual_kyc_approval_is_refused_while_the_nida_checklist_is_incomplete(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->incomplete()->create(['branch_id' => $admin->branch_id]);
        $customer->kyc()->create(['nida_number' => '19900415123450000113', 'nida_data' => [], 'nida_verified_at' => now(), 'otp_verified_at' => now()]);

        $this->postJson("/api/v1/customers/{$customer->id}/kyc/approve")->assertUnprocessable();
        $this->assertSame('pending', $customer->fresh()->kyc_status);
        $this->getJson("/api/v1/customers/{$customer->id}/eligibility")->assertOk()->assertJsonPath('data.eligible', false)->assertJsonPath('data.checklist.0.done', true)->assertJsonPath('data.checklist.2.done', false);
    }

    public function test_guarantors_can_be_managed_from_the_profile(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);

        $this->postJson("/api/v1/customers/{$customer->id}/guarantors", ['first_name' => 'john', 'last_name' => 'kisibo', 'phone' => '0714099498'])
            ->assertUnprocessable()->assertJsonValidationErrors('relationship');
        $this->postJson("/api/v1/customers/{$customer->id}/guarantors", ['first_name' => 'john', 'last_name' => 'kisibo', 'phone' => '0714099498', 'relationship' => 'rafiki'])
            ->assertCreated()->assertJsonPath('message', 'Guarantor Registered successfully');
        $guarantor = Guarantor::firstOrFail();

        $this->putJson("/api/v1/customers/guarantors/{$guarantor->id}", ['first_name' => 'john', 'last_name' => 'kisibo', 'phone' => '0714099498', 'relationship' => 'ndugu'])->assertOk();
        $this->assertSame('ndugu', $guarantor->fresh()->relationship);
        $this->getJson("/api/v1/customers/{$customer->id}")->assertJsonPath('data.guarantors.0.relationship', 'ndugu');

        $this->deleteJson("/api/v1/customers/guarantors/{$guarantor->id}")->assertOk();
        $this->assertModelMissing($guarantor);
    }

    public function test_customer_with_loans_cannot_be_deleted_and_profile_lists_loans(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $loan = Loan::factory()->create(['customer_id' => $customer->id, 'loan_category_id' => LoanCategory::factory()->create(['company_id' => $admin->company_id, 'name' => 'WAJASILIAMALI'])->id]);

        $this->getJson("/api/v1/customers/{$customer->id}")->assertOk()->assertJsonPath('data.loans.0.loan_number', $loan->loan_number)->assertJsonPath('data.loans.0.product', 'WAJASILIAMALI');
        $this->getJson("/api/v1/customers/{$customer->id}/balance")->assertOk()->assertJsonStructure(['data' => ['remain_loan', 'salary_advance', 'penalty', 'loan_fee', 'total', 'remain_cash']]);

        $this->deleteJson("/api/v1/customers/{$customer->id}")->assertUnprocessable()->assertJsonPath('message', 'Customer has loans and cannot be deleted');

        $free = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $this->deleteJson("/api/v1/customers/{$free->id}")->assertOk()->assertJsonPath('message', 'Customer Deleted successfully');
        $this->assertModelMissing($free);
    }

    private function employeeWithRole(Employee $admin, string $role): Employee
    {
        return Employee::factory()->create([
            'company_id' => $admin->company_id,
            'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', $role)->value('id'),
        ]);
    }
}
