<?php

namespace Tests\Feature\Api\Capital;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Capital;
use App\Models\DividendAllocation;
use App\Models\Employee;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DividendApiTest extends TestCase
{
    use RefreshDatabase;

    private function ledger(): Ledger
    {
        return app(Ledger::class);
    }

    private function holder(Employee $admin, string $name, float $capital): ShareHolder
    {
        $holder = ShareHolder::create(['company_id' => $admin->company_id, 'name' => $name, 'mobile' => '0777', 'email' => strtolower($name).'@example.com', 'date_of_birth' => '1990-01-01']);
        $record = Capital::create(['company_id' => $admin->company_id, 'share_holder_id' => $holder->id, 'amount' => $capital, 'pay_method' => 'CASH']);
        $this->ledger()->transfer($admin->company_id, ['account' => Account::Capital], ['account' => Account::Company], $capital, 'CAPITAL', $record);

        return $holder;
    }

    /**
     * Share register allocation proportional to each holder's capital (1 share per 1,000), without cash: dividends are
     * split by share-register ownership.
     */
    private function allocateByCapital(Employee $admin): void
    {
        $allocations = Capital::where('company_id', $admin->company_id)->orderBy('id')->get()
            ->map(fn (Capital $capital): array => ['share_holder_id' => $capital->share_holder_id, 'shares' => (int) ($capital->amount / 1000), 'treatment' => 'no_cash'])->all();

        $this->postJson('/api/v1/shares/structure', [
            'capital_basis' => Capital::where('company_id', $admin->company_id)->sum('amount'),
            'total_shares' => array_sum(array_column($allocations, 'shares')),
            'established_on' => today()->toDateString(),
            'allocations' => $allocations,
        ])->assertCreated();
    }

    /**
     * Month-end profit: interest income closed into the Profit account.
     */
    private function profit(Employee $admin, float $amount): void
    {
        $this->ledger()->journal($admin->company_id, 'MONTH END PROFIT', [
            ['account' => Account::InterestIncome, 'debit' => $amount, 'branch' => $admin->branch_id],
            ['account' => Account::RetainedProfit, 'credit' => $amount, 'branch' => $admin->branch_id],
        ]);
    }

    public function test_declaration_splits_seventy_thirty_and_allocates_by_share_register_percent(): void
    {
        $admin = $this->signInAdmin();
        $this->holder($admin, 'Mseti', 6000000);
        $this->holder($admin, 'Habakuki', 4000000);
        $this->allocateByCapital($admin);
        $this->profit($admin, 1000000);

        $this->getJson('/api/v1/capital/dividends/summary?period=2026-08')->assertOk()
            ->assertJsonPath('data.available_profit', 1000000)
            ->assertJsonPath('data.shares.0.percent', 60);

        $period = now()->subMonthNoOverflow()->format('Y-m');
        $this->postJson('/api/v1/capital/dividends', ['period' => $period, 'profit_amount' => '1,000,000'])
            ->assertCreated()->assertJsonPath('message', 'Dividend Declared successfully');

        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::RetainedProfit, allBranches: true));
        $this->assertSame(300000.0, $this->ledger()->balance($admin->company_id, Account::DividendPayable));
        $this->assertSame(10700000.0, $this->ledger()->balance($admin->company_id, Account::Capital));

        $this->getJson('/api/v1/capital/dividends')->assertOk()
            ->assertJsonPath('data.0.reinvest_amount', 700000)
            ->assertJsonPath('data.0.dividend_amount', 300000)
            ->assertJsonPath('data.0.allocations.0.amount', 180000)
            ->assertJsonPath('data.0.allocations.1.amount', 120000);

        $this->postJson('/api/v1/capital/dividends', ['period' => $period, 'profit_amount' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('period');
    }

    public function test_declaration_cannot_exceed_available_profit_or_be_in_future(): void
    {
        $admin = $this->signInAdmin();
        $this->holder($admin, 'Mseti', 1000000);
        $this->profit($admin, 50000);

        $this->postJson('/api/v1/capital/dividends', ['period' => now()->format('Y-m'), 'profit_amount' => 60000])
            ->assertUnprocessable()->assertJsonValidationErrors('profit_amount');
        $this->postJson('/api/v1/capital/dividends', ['period' => now()->addMonths(2)->format('Y-m'), 'profit_amount' => 100])
            ->assertUnprocessable()->assertJsonValidationErrors('period');
    }

    public function test_shareholder_dividend_is_paid_by_cash_or_bank(): void
    {
        $admin = $this->signInAdmin();
        $this->holder($admin, 'Mseti', 5000000);
        $this->holder($admin, 'Habakuki', 5000000);
        $this->allocateByCapital($admin);
        $this->profit($admin, 200000);
        $this->postJson('/api/v1/capital/dividends', ['period' => now()->format('Y-m'), 'profit_amount' => 200000])->assertCreated();

        [$cash, $bank] = DividendAllocation::orderBy('id')->get()->all();
        $companyBefore = $this->ledger()->balance($admin->company_id, Account::Company);

        $this->postJson("/api/v1/capital/dividends/allocations/{$cash->id}/pay", ['pay_method' => 'CASH'])
            ->assertOk()->assertJsonPath('message', 'Dividend Paid successfully');
        $this->assertSame($companyBefore - 30000, $this->ledger()->balance($admin->company_id, Account::Company));
        $this->assertSame(30000.0, $this->ledger()->balance($admin->company_id, Account::DividendPayable));
        $this->postJson("/api/v1/capital/dividends/allocations/{$cash->id}/pay", ['pay_method' => 'CASH'])->assertUnprocessable();

        $nmb = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'NMB']);
        $this->postJson("/api/v1/capital/dividends/allocations/{$bank->id}/pay", ['pay_method' => 'BANK'])->assertUnprocessable()->assertJsonValidationErrors('bank_account_id');
        $this->postJson("/api/v1/capital/dividends/allocations/{$bank->id}/pay", ['pay_method' => 'BANK', 'bank_account_id' => $nmb->id])->assertUnprocessable()->assertJsonValidationErrors('pay_method');

        $this->ledger()->openingBalance($admin->company_id, Account::Bank, 100000, bankAccount: $nmb);
        $this->postJson("/api/v1/capital/dividends/allocations/{$bank->id}/pay", ['pay_method' => 'BANK', 'bank_account_id' => $nmb->id, 'reference' => 'TRX1'])->assertOk();
        $this->assertSame(70000.0, $this->ledger()->balance($admin->company_id, Account::Bank, bankAccount: $nmb));
        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::DividendPayable));
        $this->assertSame('paid', $bank->fresh()->status);
    }

    public function test_dividends_require_capital_manage(): void
    {
        $admin = $this->signInAdmin();
        $finance = Employee::factory()->create([
            'company_id' => $admin->company_id, 'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', 'finance')->value('id'),
        ]);

        $this->actingAs($finance)->getJson('/api/v1/capital/dividends')->assertForbidden();
        $this->actingAs($finance)->postJson('/api/v1/capital/dividends', ['period' => now()->format('Y-m'), 'profit_amount' => 1])->assertForbidden();
    }
}
