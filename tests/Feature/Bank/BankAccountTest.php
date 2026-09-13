<?php

namespace Tests\Feature\Bank;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Company;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_list_renders(): void
    {
        $admin = $this->signInAdmin();
        BankAccount::create(['company_id' => $admin->company_id, 'name' => 'NMB']);

        $this->get(route('bank-accounts.index'))
            ->assertOk()
            ->assertSee('Account List')
            ->assertSee('Enter Account name')
            ->assertSee('NMB');
    }

    public function test_admin_can_create_update_and_delete_an_account(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('bank-accounts.store'), ['ac_name' => 'CRDB'])->assertRedirect();
        $account = BankAccount::where('company_id', $admin->company_id)->where('name', 'CRDB')->firstOrFail();

        $this->put(route('bank-accounts.update', $account), ['ac_name' => 'NBC'])->assertRedirect();
        $this->assertSame('NBC', $account->fresh()->name);

        $this->delete(route('bank-accounts.destroy', $account))->assertRedirect();
        $this->assertModelMissing($account);
    }

    public function test_balance_page_shows_ledger_balances_and_total(): void
    {
        $admin = $this->signInAdmin();
        $nmb = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'NMB']);
        $crdb = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'CRDB']);
        app(Ledger::class)->post($admin->company_id, Account::Bank, 16200, 'Deposit', bankAccount: $nmb);
        app(Ledger::class)->post($admin->company_id, Account::Bank, 2000, 'Deposit', bankAccount: $crdb);

        $this->get(route('bank-accounts.balance'))
            ->assertOk()
            ->assertSee('Account Balance')
            ->assertSee('16,200')
            ->assertSee('18,200');
    }

    public function test_accounts_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = BankAccount::create(['company_id' => Company::factory()->create()->id, 'name' => 'NMB']);

        $this->delete(route('bank-accounts.destroy', $foreign))->assertNotFound();
        $this->assertModelExists($foreign);
    }
}
