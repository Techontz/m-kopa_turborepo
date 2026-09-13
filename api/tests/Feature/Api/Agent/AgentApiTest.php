<?php

namespace Tests\Feature\Api\Agent;

use App\Enums\Account;
use App\Models\AgentTransaction;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\PaymentMode;
use App\Services\AgentTransactionService;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_payment_modes_can_be_listed_created_and_deleted(): void
    {
        $admin = $this->signInAdmin();

        $id = $this->postJson('/api/v1/agent/payment-modes', ['pay_mode' => 'M-PESA'])
            ->assertCreated()->assertJsonPath('message', 'Mode of payment Registered successfully')->json('data.id');
        $this->getJson('/api/v1/agent/payment-modes')->assertOk()->assertJsonPath('data.0.name', 'M-PESA');
        $this->assertSame($admin->company_id, PaymentMode::find($id)->company_id);

        $this->postJson('/api/v1/agent/payment-modes', [])->assertUnprocessable()->assertJsonValidationErrors('pay_mode');

        $this->deleteJson("/api/v1/agent/payment-modes/{$id}")->assertOk();
        $this->assertDatabaseMissing('payment_modes', ['id' => $id]);

        $foreign = PaymentMode::create(['company_id' => Company::factory()->create()->id, 'name' => 'OTHER']);
        $this->deleteJson("/api/v1/agent/payment-modes/{$foreign->id}")->assertNotFound();
    }

    public function test_recording_a_transaction_posts_suspense_to_agent_and_can_be_reversed(): void
    {
        $admin = $this->signInAdmin();
        $mode = PaymentMode::create(['company_id' => $admin->company_id, 'name' => 'TIGO PESA']);
        $ledger = app(Ledger::class);

        $this->postJson('/api/v1/agent/transactions', [
            'blanch_id' => $admin->branch_id, 'mode_id' => $mode->id, 'agent' => 'JUMA AGENT', 'amount' => 50000, 'date' => today()->toDateString(), 'time' => '10:30',
        ])->assertCreated()->assertJsonPath('message', 'Transaction Recorded successfully');

        $this->assertEquals(50000, $ledger->balance($admin->company_id, Account::Agent, $admin->branch_id));
        $this->assertEquals(50000, $ledger->balance($admin->company_id, Account::Suspense, $admin->branch_id));

        $this->getJson('/api/v1/agent/transactions')->assertOk()
            ->assertJsonPath('data.0.agent', 'JUMA AGENT')
            ->assertJsonPath('data.0.payment_mode', 'TIGO PESA')
            ->assertJsonPath('data.0.transaction_time', '10:30:00');
        $this->getJson('/api/v1/agent/transactions?branch_id=all&from=2000-01-01&to=2000-01-01')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/agent/balances')->assertOk()->assertJsonPath('data.0.amount', 50000);

        $transaction = AgentTransaction::firstOrFail();
        $this->postJson("/api/v1/agent/transactions/{$transaction->id}/reverse", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/v1/agent/transactions/{$transaction->id}/reverse", ['reason' => 'Duplicate'])->assertOk();
        $this->postJson("/api/v1/agent/transactions/{$transaction->id}/reverse", ['reason' => 'Duplicate'])->assertUnprocessable();

        $this->assertEquals(0, $ledger->balance($admin->company_id, Account::Agent, $admin->branch_id));
        $this->assertNotNull($transaction->fresh()->reversed_at);
        $this->assertModelExists($transaction);
    }

    public function test_record_validation(): void
    {
        $this->signInAdmin();

        $this->postJson('/api/v1/agent/transactions', ['amount' => 0, 'time' => 'x'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['blanch_id', 'mode_id', 'agent', 'amount', 'date', 'time']);
    }

    public function test_deposit_list_shows_todays_customer_deposits(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        app(AgentTransactionService::class)->customerDeposit($customer, 12000, 100000, $admin);
        app(AgentTransactionService::class)->customerDeposit($customer, 5000, 100000, $admin, today()->subDays(3)->toImmutable());

        $this->getJson('/api/v1/agent/deposits')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer', $customer->full_name)
            ->assertJsonPath('data.0.loan_amount', 100000)
            ->assertJsonPath('data.0.user', $admin->full_name);
        $this->getJson('/api/v1/agent/deposits?branch_id=all&from='.today()->subDays(5)->toDateString().'&to='.today()->toDateString())->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/agent/transactions')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_permission_and_branch_scope(): void
    {
        $admin = $this->signInAdmin();
        $otherBranch = Branch::factory()->create(['company_id' => $admin->company_id]);
        $mode = PaymentMode::create(['company_id' => $admin->company_id, 'name' => 'M-PESA']);
        $service = app(AgentTransactionService::class);
        $service->record($admin->company_id, ['branch_id' => $admin->branch_id, 'payment_mode_id' => $mode->id, 'agent' => 'A', 'amount' => 1000, 'date' => today()->toDateString(), 'time' => '09:00']);
        $foreign = $service->record($admin->company_id, ['branch_id' => $otherBranch->id, 'payment_mode_id' => $mode->id, 'agent' => 'B', 'amount' => 1000, 'date' => today()->toDateString(), 'time' => '09:00']);

        $teller = Employee::factory()->create([
            'company_id' => $admin->company_id,
            'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', 'teller')->value('id'),
        ]);
        $this->actingAs($teller);
        $this->getJson('/api/v1/agent/transactions')->assertForbidden();
        $this->postJson('/api/v1/agent/transactions', [])->assertForbidden();

        $teller->role->permissions()->createMany([['permission' => 'agent.manage'], ['permission' => 'accounting.reverse']]);
        $this->actingAs($teller->fresh());
        $this->getJson('/api/v1/agent/transactions')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.agent', 'A');
        $this->getJson('/api/v1/agent/balances')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/agent/transactions/{$foreign->id}/reverse", ['reason' => 'x'])->assertForbidden();
        $this->postJson('/api/v1/agent/transactions', [
            'blanch_id' => $otherBranch->id, 'mode_id' => $mode->id, 'agent' => 'C', 'amount' => 1000, 'date' => today()->toDateString(), 'time' => '09:00',
        ])->assertForbidden();
    }
}
