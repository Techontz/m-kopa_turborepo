<?php

namespace Tests\Feature\Agent;

use App\Enums\Account;
use App\Models\AgentTransaction;
use App\Models\Company;
use App\Models\Customer;
use App\Models\PaymentMode;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgentTransactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_payment_modes(): void
    {
        $admin = $this->signInAdmin();

        $this->get(route('payment-modes.index'))->assertOk()->assertSee('Mode of Payment List');

        $this->post(route('payment-modes.store'), ['pay_mode' => 'M-PESA'])->assertRedirect();
        $mode = PaymentMode::where('name', 'M-PESA')->firstOrFail();
        $this->assertSame($admin->company_id, $mode->company_id);
        $this->get(route('payment-modes.index'))->assertSee('M-PESA');

        $this->delete(route('payment-modes.destroy', $mode))->assertRedirect();
        $this->assertModelMissing($mode);
    }

    public function test_recording_a_transaction_posts_to_the_branch_agent_account(): void
    {
        $admin = $this->signInAdmin();
        $mode = PaymentMode::create(['company_id' => $admin->company_id, 'name' => 'TIGO PESA']);

        $this->post(route('agent-transactions.store'), [
            'blanch_id' => $admin->branch_id,
            'mode_id' => $mode->id,
            'agent' => 'JUMA AGENT',
            'amount' => 50000,
            'date' => today()->toDateString(),
            'time' => '10:30',
        ])->assertRedirect();

        $this->assertDatabaseHas('agent_transactions', ['agent' => 'JUMA AGENT', 'amount' => 50000, 'branch_id' => $admin->branch_id]);
        $this->assertEquals(50000, app(Ledger::class)->balance($admin->company_id, Account::Agent, $admin->branch_id));

        $this->get(route('agent-transactions.record'))
            ->assertOk()
            ->assertSee('transaction list')
            ->assertSee('JUMA AGENT')
            ->assertSee('TIGO PESA');
    }

    public function test_deposit_page_lists_todays_customer_transactions(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        AgentTransaction::create([
            'company_id' => $admin->company_id,
            'branch_id' => $admin->branch_id,
            'customer_id' => $customer->id,
            'amount' => 12000,
            'loan_amount' => 100000,
            'transaction_date' => today(),
        ]);

        $this->get(route('agent-transactions.deposit'))
            ->assertOk()
            ->assertSee('Deposit Amount')
            ->assertSee($customer->full_name);
    }

    public function test_payment_modes_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = PaymentMode::create(['company_id' => Company::factory()->create()->id, 'name' => 'OTHER']);

        $this->delete(route('payment-modes.destroy', $foreign))->assertNotFound();
        $this->assertModelExists($foreign);
    }
}
