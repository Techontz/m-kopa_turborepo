<?php

namespace Tests\Feature\Api\Bank;

use App\Models\Employee;
use App\Models\ShareHolder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bank accounts and bank transfers are company money: only Super Admin, Admin or a shareholder of the company may reach
 * them — no other role, even when the role or a staff privilege grants bank.manage.
 */
class BankAccessTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
    }

    public function test_super_admin_and_admin_reach_the_bank_module(): void
    {
        $this->getJson('/api/v1/bank/accounts')->assertOk();
        $this->actingAs($this->staff('admin'))->getJson('/api/v1/bank/transfers')->assertOk();
    }

    public function test_finance_and_other_roles_are_refused_even_with_bank_manage_granted(): void
    {
        $finance = $this->staff('finance');
        $this->actingAs($finance)->getJson('/api/v1/bank/accounts')->assertForbidden();

        $finance->role->permissions()->firstOrCreate(['permission' => 'bank.manage']);
        $finance->permissionOverrides()->create(['permission' => 'bank.manage', 'granted' => true]);
        $finance = $finance->fresh();

        $this->assertFalse($finance->can('bank.manage'));
        $this->actingAs($finance)->getJson('/api/v1/bank/balances')->assertForbidden();
        $this->actingAs($finance)->getJson('/api/v1/bank/petty-cash')->assertForbidden();
    }

    public function test_a_staff_login_linked_to_a_shareholder_may_be_given_the_bank_module(): void
    {
        $finance = $this->staff('finance');
        $finance->permissionOverrides()->create(['permission' => 'bank.manage', 'granted' => true]);
        ShareHolder::create([
            'company_id' => $this->admin->company_id, 'employee_id' => $finance->id, 'first_name' => 'ASHA', 'last_name' => 'HOLDER',
            'mobile' => '0777', 'email' => 'asha@example.com', 'date_of_birth' => '1990-01-01',
        ]);

        $this->actingAs($finance->fresh())->getJson('/api/v1/bank/accounts')->assertOk();
    }

    private function staff(string $role): Employee
    {
        return Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'role_id' => $this->admin->company->roles()->where('key', $role)->value('id'),
        ]);
    }
}
