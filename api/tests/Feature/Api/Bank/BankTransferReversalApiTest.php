<?php

namespace Tests\Feature\Api\Bank;

use App\Enums\Account;
use App\Models\AccountingPeriod;
use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\Company;
use App\Models\DividendDeclaration;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\Concerns\UsesSecondApprover;
use Tests\TestCase;

class BankTransferReversalApiTest extends TestCase
{
    use RefreshDatabase;
    use UsesSecondApprover;

    private Employee $admin;

    private Ledger $ledger;

    private BankAccount $bank;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->ledger = app(Ledger::class);
        $this->bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
    }

    public function test_bank_to_hq_reversal_restores_bank_hq_account_and_charges(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, bankAccount: $this->bank);
        $this->approve($this->postJson('/api/v1/bank/to-hq', ['from_acc' => $this->bank->id, 'amount' => 50000, 'to_acc' => 'disbursement', 'charger_fee' => 2000])->assertCreated()->json('data.id'));
        $transfer = BankTransfer::firstOrFail();
        $this->assertNotNull($transfer->journal_entry_id);
        $this->assertSame(48000.0, $this->bank->balance());

        $this->getJson('/api/v1/bank/to-hq')->assertOk()->assertJsonPath('data.0.can_reverse', true);
        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Wrong account'])->assertOk()->assertJsonPath('data.status', 'reversed');

        $this->assertSame(100000.0, $this->bank->balance());
        $this->assertSame(0.0, $this->ledger->balance($this->admin->company_id, Account::HqDisbursement));
        $this->assertSame(0.0, $this->ledger->balance($this->admin->company_id, Account::BankCharges));

        $transfer->refresh();
        $this->assertSame('Wrong account', $transfer->reversal_reason);
        $this->assertSame($transfer->journal_entry_id, JournalEntry::findOrFail($transfer->reversal_journal_entry_id)->reversal_of_id);
        $this->assertTrue(AuditLog::where('action', 'BankTransfer.reversed')->where('auditable_id', $transfer->id)->exists());

        $this->getJson('/api/v1/bank/to-hq')->assertOk()
            ->assertJsonPath('data.0.status', 'reversed')
            ->assertJsonPath('data.0.reversed_by', $this->admin->full_name)
            ->assertJsonPath('total', 0)
            ->assertJsonPath('total_charge', 0)
            ->assertJsonPath('total_reversed', 50000);

        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Again'])->assertUnprocessable()->assertJsonPath('errors.reason.0', 'This transfer has already been reversed.');
    }

    public function test_bank_to_hq_reversal_is_blocked_once_the_hq_account_spent_the_money(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, bankAccount: $this->bank);
        $this->approve($this->postJson('/api/v1/bank/to-hq', ['from_acc' => $this->bank->id, 'amount' => 30000, 'to_acc' => 'salary', 'charger_fee' => 500])->assertCreated()->json('data.id'));
        $transfer = BankTransfer::firstOrFail();

        $this->ledger->transfer($this->admin->company_id, ['account' => Account::HqSalaryAdvance], ['account' => Account::Company], 20000, 'Spent');
        $entries = JournalEntry::count();

        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Mistake'])->assertUnprocessable()
            ->assertJsonPath('errors.reason.0', 'The receiving account (SALARY ADVANCE ACCOUNT) no longer holds TZS 30,000 (balance TZS 10,000); the money has already been used.');
        $this->assertSame($entries, JournalEntry::count());
        $this->assertSame('approved', $transfer->fresh()->status);

        $this->ledger->transfer($this->admin->company_id, ['account' => Account::Company], ['account' => Account::HqSalaryAdvance], 20000, 'Returned');
        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Mistake'])->assertOk();
        $this->assertSame(100000.0, $this->bank->balance());
        $this->assertSame(0.0, $this->ledger->balance($this->admin->company_id, Account::HqSalaryAdvance));
    }

    public function test_branch_to_bank_and_company_cash_bank_reversals(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Interest, 40000, branch: $this->admin->branch_id);
        $this->ledger->openingBalance($this->admin->company_id, Account::Company, 70000);

        $this->postJson('/api/v1/bank/transfers', ['from_blanch_id' => $this->admin->branch_id, 'ac_type' => Account::Interest->value, 'amount' => 15000, 'to_account_id' => $this->bank->id])->assertCreated();
        $request = BankTransfer::firstOrFail();
        $this->postJson("/api/v1/bank/transfers/{$request->id}/reverse", ['reason' => 'Pending'])->assertUnprocessable();
        $this->approve($request->id);
        $this->assertNotNull($request->fresh()->journal_entry_id);

        $this->approve($this->postJson('/api/v1/bank/company-transfers', ['direction' => 'company_to_bank', 'bank_account_id' => $this->bank->id, 'amount' => 25000])->assertCreated()->json('data.id'));
        $deposit = BankTransfer::where('type', 'company_to_bank')->firstOrFail();
        $this->assertSame(40000.0, $this->bank->balance());

        $this->postJson("/api/v1/bank/transfers/{$deposit->id}/reverse", ['reason' => 'Slip rejected'])->assertOk();
        $this->assertSame(70000.0, $this->ledger->balance($this->admin->company_id, Account::Company));
        $this->getJson('/api/v1/bank/company-transfers')->assertOk()->assertJsonPath('data.0.status', 'reversed')->assertJsonPath('total', 0)->assertJsonPath('total_reversed', 25000);

        $this->getJson('/api/v1/bank/transfers?status=approved')->assertOk()->assertJsonPath('data.0.can_reverse', true);
        $this->postJson("/api/v1/bank/transfers/{$request->id}/reverse", ['reason' => 'Wrong account'])->assertOk();
        $this->assertSame(40000.0, $this->ledger->balance($this->admin->company_id, Account::Interest, $this->admin->branch_id));
        $this->assertSame(0.0, $this->bank->balance());
        $this->getJson('/api/v1/bank/transfers?status=approved')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'reversed');
    }

    public function test_charge_in_a_closed_period_with_distributed_profit_blocks_the_reversal(): void
    {
        $this->travelTo(now()->subMonth()->startOfMonth()->addDays(4));
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, bankAccount: $this->bank);
        $this->approve($this->postJson('/api/v1/bank/to-hq', ['from_acc' => $this->bank->id, 'amount' => 50000, 'to_acc' => 'disbursement', 'charger_fee' => 1000])->assertCreated()->json('data.id'));
        $month = now()->startOfMonth();
        $this->travelBack();

        $transfer = BankTransfer::firstOrFail();
        AccountingPeriod::create(['company_id' => $this->admin->company_id, 'period_start' => $month->toDateString(), 'period_end' => $month->copy()->endOfMonth()->toDateString(), 'status' => 'closed']);
        DividendDeclaration::create(['company_id' => $this->admin->company_id, 'period' => $month->toDateString(), 'profit_amount' => 1, 'reinvest_percent' => 70, 'reinvest_amount' => 0.7, 'dividend_percent' => 30, 'dividend_amount' => 0.3]);

        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Late'])->assertUnprocessable()
            ->assertJsonPath('errors.reason.0', 'The profit of '.$month->format('F Y').' has already been distributed (dividend declaration); this reversal would change a distributed period and is blocked.');
        $this->assertSame('approved', $transfer->fresh()->status);
    }

    public function test_rollback_permissions_and_company_isolation(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 10000, bankAccount: $this->bank);
        $this->approve($this->postJson('/api/v1/bank/to-hq', ['from_acc' => $this->bank->id, 'amount' => 5000, 'to_acc' => 'disbursement', 'charger_fee' => 0])->assertCreated()->json('data.id'));
        $transfer = BankTransfer::firstOrFail();

        $foreignCompany = Company::factory()->create();
        $foreign = BankTransfer::create(['company_id' => $foreignCompany->id, 'type' => 'bank_to_hq', 'amount' => 1, 'status' => 'approved', 'transfer_date' => today()]);
        $this->postJson("/api/v1/bank/transfers/{$foreign->id}/reverse", ['reason' => 'Mistake'])->assertNotFound();

        $roles = $this->admin->company->roles()->pluck('id', 'key');
        $admin = Employee::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id, 'role_id' => $roles['admin']]);
        $this->actingAs($admin)->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Mistake'])->assertForbidden();
        $this->actingAs($admin)->getJson('/api/v1/bank/to-hq')->assertOk()->assertJsonPath('data.0.can_reverse', false);

        $this->actingAs($this->admin);
        $entries = JournalEntry::count();
        $real = $this->ledger;
        $this->partialMock(Ledger::class, function ($mock) use ($real): void {
            $mock->shouldReceive('reverse')->andReturnUsing(function (JournalEntry $entry, string $reason) use ($real): never {
                $real->reverse($entry, $reason);

                throw new RuntimeException('Ledger failure');
            });
        });

        $this->withoutExceptionHandling();
        try {
            $this->postJson("/api/v1/bank/transfers/{$transfer->id}/reverse", ['reason' => 'Mistake']);
            $this->fail('The posting failure must surface.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Ledger failure', $exception->getMessage());
        }

        $this->assertSame($entries, JournalEntry::count());
        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(5000.0, $real->balance($this->admin->company_id, Account::HqDisbursement));
    }

    /**
     * Rule 6: movements requested by the signed-in admin are approved (posted) by a second authorised user.
     */
    private function approve(int $id): void
    {
        $this->approveAsSecondUser($this->admin, "/api/v1/bank/transfers/{$id}/approve");
    }
}
