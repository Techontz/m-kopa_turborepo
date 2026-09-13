<?php

namespace Tests\Feature\Hq;

use App\Enums\Account;
use App\Models\Company;
use App\Models\HqTransaction;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HqTransactionTest extends TestCase
{
    use RefreshDatabase;

    public function test_balance_page_lists_hq_accounts_with_total(): void
    {
        $admin = $this->signInAdmin();
        $ledger = app(Ledger::class);
        $ledger->openingBalance($admin->company_id, Account::HqSalaryAdvance, 198190, 'Seed');
        $ledger->openingBalance($admin->company_id, Account::HqDisbursement, 7184000, 'Seed', date: today()->subDays(10));

        $this->get(route('hq-transactions.balance'))
            ->assertOk()
            ->assertSee('Headquater Account Balance')
            ->assertSee('SAVING ACCOUNT')
            ->assertSee('7,382,190');

        $this->get(route('hq-transactions.balance', ['from' => today()->subMonth()->toDateString(), 'to' => today()->subDays(5)->toDateString()]))
            ->assertOk()
            ->assertDontSee('7,382,190');
    }

    public function test_transaction_is_requested_then_approved_moving_money(): void
    {
        $admin = $this->signInAdmin();
        $ledger = app(Ledger::class);
        $ledger->openingBalance($admin->company_id, Account::HqInterest, 100000, 'Seed');

        $this->get(route('hq-transactions.requests'))->assertOk()->assertSee('From Headquater Transaction - CEO ACC');

        $this->post(route('hq-transactions.store'), [
            'from_account' => Account::HqInterest->value,
            'to_account' => Account::HqDisbursement->value,
            'amount' => 60000,
            'charge' => 1000,
        ])->assertRedirect();

        $transaction = HqTransaction::firstOrFail();
        $this->assertSame('pending', $transaction->status);

        $this->post(route('hq-transactions.approve', $transaction))->assertRedirect();

        $transaction->refresh();
        $this->assertSame('approved', $transaction->status);
        $this->assertNotNull($transaction->approved_at);
        $this->assertSame(39000.0, $ledger->balance($admin->company_id, Account::HqInterest));
        $this->assertSame(60000.0, $ledger->balance($admin->company_id, Account::HqDisbursement));

        $this->get(route('hq-transactions.approved'))->assertOk()->assertSee('Aproved Date')->assertSee('60,000');
    }

    public function test_same_account_transfer_is_rejected(): void
    {
        $this->signInAdmin();

        $this->post(route('hq-transactions.store'), [
            'from_account' => Account::HqInterest->value, 'to_account' => Account::HqInterest->value, 'amount' => 100,
        ])->assertSessionHasErrors('to_account');
    }

    public function test_approval_fails_on_insufficient_balance(): void
    {
        $admin = $this->signInAdmin();
        $transaction = HqTransaction::create([
            'company_id' => $admin->company_id, 'from_account' => Account::HqReserve->value, 'to_account' => Account::HqSaving->value,
            'amount' => 5000, 'status' => 'pending',
        ]);

        $this->post(route('hq-transactions.approve', $transaction))->assertSessionHas('error');
        $this->assertSame('pending', $transaction->fresh()->status);
    }

    public function test_foreign_transactions_are_not_reachable(): void
    {
        $this->signInAdmin();
        $transaction = HqTransaction::create([
            'company_id' => Company::factory()->create()->id, 'from_account' => Account::HqReserve->value,
            'to_account' => Account::HqSaving->value, 'amount' => 5000, 'status' => 'pending',
        ]);

        $this->post(route('hq-transactions.approve', $transaction))->assertNotFound();
    }
}
