<?php

namespace Tests\Feature\Saving;

use App\Enums\Account;
use App\Models\Customer;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SavingTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_page_links_to_customer_saving_page(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);

        $this->get(route('savings.search'))
            ->assertOk()
            ->assertSee('Search Customer')
            ->assertSee(route('savings.show', $customer));

        $this->get(route('savings.show', $customer))->assertOk()->assertSee($customer->full_name);
    }

    public function test_deposit_and_withdrawal_move_the_saving_ledger(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $ledger = app(Ledger::class);

        $this->post(route('savings.store', $customer), ['type' => 'deposit', 'amount' => 50000])->assertRedirect();
        $this->post(route('savings.store', $customer), ['type' => 'withdrawal', 'amount' => 60000])->assertSessionHas('error');
        $this->post(route('savings.store', $customer), ['type' => 'withdrawal', 'amount' => 20000, 'description' => 'SAVING TAKEN'])->assertRedirect();

        $this->assertDatabaseCount('savings', 2);
        $this->assertEquals(30000, $ledger->balance($admin->company_id, Account::HqSaving, $admin->branch_id));

        $this->get(route('savings.show', $customer))->assertSee('30,000');
        $this->get(route('savings.deposits'))->assertOk()->assertSee('Today saving Deposit')->assertSee('50,000');
        $this->get(route('savings.withdrawals'))->assertOk()->assertSee('All Saving withdrawal')->assertSee('SAVING TAKEN');
        $this->get(route('savings.balance'))->assertOk()->assertSee('Saving Deposit balance')->assertSee('30,000');
    }

    public function test_customers_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = Customer::factory()->create();

        $this->get(route('savings.show', $foreign))->assertNotFound();
        $this->post(route('savings.store', $foreign), ['type' => 'deposit', 'amount' => 1000])->assertNotFound();
        $this->assertDatabaseCount('savings', 0);
    }
}
