<?php

namespace Tests\Feature\Visa;

use App\Models\Customer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VisaTest extends TestCase
{
    use RefreshDatabase;

    public function test_bank_account_list_shows_employed_customers(): void
    {
        $admin = $this->signInAdmin();
        $employed = Customer::factory()->create(['branch_id' => $admin->branch_id, 'work_status' => 'ent', 'bank_account_name' => 'CRDB']);
        $entrepreneur = Customer::factory()->create(['branch_id' => $admin->branch_id, 'work_status' => 'ser']);

        $this->get(route('visa.index'))
            ->assertOk()
            ->assertSee('Bank Account List')
            ->assertSee($employed->full_name)
            ->assertSee('CRDB')
            ->assertViewHas('customers', fn ($customers): bool => ! $customers->contains($entrepreneur));
    }

    public function test_account_name_and_password_can_be_updated(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id, 'work_status' => 'ent']);

        $this->put(route('visa.update', $customer), ['ac_name' => 'NBC', 'ac_password' => '1234'])->assertRedirect();

        $customer->refresh();
        $this->assertSame('NBC', $customer->bank_account_name);
        $this->assertSame('1234', $customer->bank_password);
    }

    public function test_customers_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = Customer::factory()->create(['work_status' => 'ent']);

        $this->put(route('visa.update', $foreign), ['ac_name' => 'NBC'])->assertNotFound();
        $this->assertNull($foreign->fresh()->bank_account_name);
    }
}
