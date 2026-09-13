<?php

namespace Tests\Feature\Api\Hq;

use App\Enums\Account;
use App\Models\Company;
use App\Models\Employee;
use App\Models\HqTransaction;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HqTransactionApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_balances_list_hq_accounts_with_total_and_as_at_date(): void
    {
        $admin = $this->signInAdmin();
        $ledger = app(Ledger::class);
        $ledger->openingBalance($admin->company_id, Account::HqSalaryAdvance, 198190);
        $ledger->openingBalance($admin->company_id, Account::HqDisbursement, 7184000, date: today()->subDays(10));

        $this->getJson('/api/v1/hq/balances')->assertOk()
            ->assertJsonCount(7, 'data')
            ->assertJsonPath('data.6.name', 'SAVING ACCOUNT')
            ->assertJsonPath('total', 7382190);

        $this->getJson('/api/v1/hq/balances?to='.today()->subDays(5)->toDateString())->assertJsonPath('total', 7184000);
    }

    public function test_transaction_is_requested_approved_and_listed(): void
    {
        $admin = $this->signInAdmin();
        $ledger = app(Ledger::class);
        $ledger->openingBalance($admin->company_id, Account::HqInterest, 100000);

        $this->postJson('/api/v1/hq/transactions', [
            'from_account' => Account::HqInterest->value, 'to_account' => Account::HqDisbursement->value, 'amount' => 60000, 'charge' => 1000,
        ])->assertCreated()->assertJsonPath('message', 'Transaction Requested successfully');

        $transaction = HqTransaction::firstOrFail();
        $this->getJson('/api/v1/hq/transactions')->assertOk()->assertJsonPath('data.0.from_account_label', 'INTEREST ACCOUNT')->assertJsonPath('total_charge', 1000);

        $this->postJson("/api/v1/hq/transactions/{$transaction->id}/approve")->assertOk()->assertJsonPath('message', 'Transaction Aproved successfully');

        $transaction->refresh();
        $this->assertSame('approved', $transaction->status);
        $this->assertSame($admin->id, $transaction->approved_by);
        $this->assertSame(39000.0, $ledger->balance($admin->company_id, Account::HqInterest));
        $this->assertSame(60000.0, $ledger->balance($admin->company_id, Account::HqDisbursement));

        $this->getJson('/api/v1/hq/transactions?status=approved&from='.today()->toDateString().'&to='.today()->toDateString())->assertJsonPath('data.0.approved_at', today()->toDateString());
        $this->getJson('/api/v1/hq/transactions?status=approved&from=2020-01-01&to=2020-01-02')->assertJsonCount(0, 'data');
        $this->postJson("/api/v1/hq/transactions/{$transaction->id}/approve")->assertUnprocessable();
        $this->deleteJson("/api/v1/hq/transactions/{$transaction->id}")->assertUnprocessable();
    }

    public function test_validation_insufficient_balance_and_delete(): void
    {
        $admin = $this->signInAdmin();

        $this->postJson('/api/v1/hq/transactions', [
            'from_account' => Account::HqInterest->value, 'to_account' => Account::HqInterest->value, 'amount' => 100,
        ])->assertUnprocessable()->assertJsonValidationErrors('to_account');

        $transaction = HqTransaction::create([
            'company_id' => $admin->company_id, 'from_account' => Account::HqReserve->value, 'to_account' => Account::HqSaving->value, 'amount' => 5000, 'status' => 'pending',
        ]);

        $this->postJson("/api/v1/hq/transactions/{$transaction->id}/approve")->assertUnprocessable();
        $this->assertSame('pending', $transaction->fresh()->status);

        $this->deleteJson("/api/v1/hq/transactions/{$transaction->id}")->assertOk();
        $this->assertModelMissing($transaction);
    }

    public function test_permission_and_company_isolation(): void
    {
        $admin = $this->signInAdmin();
        $foreign = HqTransaction::create([
            'company_id' => Company::factory()->create()->id, 'from_account' => Account::HqReserve->value,
            'to_account' => Account::HqSaving->value, 'amount' => 5000, 'status' => 'pending',
        ]);

        $this->postJson("/api/v1/hq/transactions/{$foreign->id}/approve")->assertNotFound();

        $manager = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'role_id' => $admin->company->roles()->where('key', 'branch_manager')->value('id')]);
        $this->actingAs($manager);
        $this->getJson('/api/v1/hq/balances')->assertForbidden();
        $this->postJson('/api/v1/hq/transactions', [])->assertForbidden();
    }
}
