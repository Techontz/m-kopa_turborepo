<?php

namespace Tests\Feature\Bank;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\Branch;
use App\Models\Employee;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BankTransferTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private BankAccount $bank;

    private Ledger $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $this->ledger = app(Ledger::class);
    }

    public function test_pages_render(): void
    {
        $this->get(route('bank-transfers.index'))->assertOk()->assertSee('Transaction list')->assertSee('PENARTY A/C')->assertSee('Transfar');
        $this->get(route('bank-transfers.approved'))->assertOk()->assertSee('Transaction Aproved list');
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 16200, 'Deposit', bankAccount: $this->bank);
        $this->get(route('bank-transfers.to-branch'))->assertOk()->assertSee('To Brach')->assertSee('NMB - 16,200');
        $this->get(route('bank-transfers.to-hq'))->assertOk()->assertSee('DISBURSEMENT ACC');
    }

    public function test_branch_to_bank_request_is_pending_until_approved(): void
    {
        $branch = $this->admin->branch;
        $this->ledger->openingBalance($this->admin->company_id, Account::LoanFee, 150000, 'Fees', $branch);

        $this->post(route('bank-transfers.store'), [
            'from_blanch_id' => $branch->id,
            'ac_type' => Account::LoanFee->value,
            'amount' => 110000,
            'to_account_id' => $this->bank->id,
        ])->assertRedirect();

        $transfer = BankTransfer::firstOrFail();
        $this->assertSame('pending', $transfer->status);
        $this->assertSame(0.0, $this->bank->balance());

        $this->post(route('bank-transfers.approve', $transfer))->assertRedirect();

        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(110000.0, $this->bank->balance());
        $this->assertSame(40000.0, $this->ledger->balance($this->admin->company_id, Account::LoanFee, $branch));
        $this->get(route('bank-transfers.approved', ['blanch_id' => 'all']))->assertSee('110,000');
    }

    public function test_approval_fails_on_insufficient_branch_balance(): void
    {
        $transfer = BankTransfer::create([
            'company_id' => $this->admin->company_id, 'type' => 'branch_to_bank', 'branch_id' => $this->admin->branch_id,
            'branch_account' => Account::Principal->value, 'bank_account_id' => $this->bank->id, 'amount' => 5000,
            'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->post(route('bank-transfers.approve', $transfer))->assertSessionHas('error');
        $this->assertSame('pending', $transfer->fresh()->status);
    }

    public function test_pending_transfer_can_be_deleted(): void
    {
        $transfer = BankTransfer::create([
            'company_id' => $this->admin->company_id, 'type' => 'branch_to_bank', 'branch_id' => $this->admin->branch_id,
            'branch_account' => Account::Principal->value, 'bank_account_id' => $this->bank->id, 'amount' => 5000,
            'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->delete(route('bank-transfers.destroy', $transfer))->assertRedirect();
        $this->assertModelMissing($transfer);
    }

    public function test_bank_to_branch_moves_amount_and_charge(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, 'Deposit', bankAccount: $this->bank);

        $this->post(route('bank-transfers.to-branch.store'), [
            'from_account' => $this->bank->id,
            'to_blanch' => $this->admin->branch_id,
            'amount' => 50000,
            'charger_fee' => 1000,
        ])->assertRedirect()->assertSessionHas('success');

        $this->assertSame(49000.0, $this->bank->balance());
        $this->assertSame(50000.0, $this->ledger->balance($this->admin->company_id, Account::Principal, $this->admin->branch_id));
        $this->assertDatabaseHas('bank_transfers', ['type' => 'bank_to_branch', 'status' => 'approved', 'charge' => 1000]);
    }

    public function test_bank_to_branch_rejects_insufficient_bank_balance(): void
    {
        $this->post(route('bank-transfers.to-branch.store'), [
            'from_account' => $this->bank->id,
            'to_blanch' => $this->admin->branch_id,
            'amount' => 50000,
            'charger_fee' => 0,
        ])->assertSessionHas('error');

        $this->assertDatabaseCount('bank_transfers', 0);
    }

    public function test_bank_to_hq_credits_disbursement_account(): void
    {
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, 'Deposit', bankAccount: $this->bank);

        $this->post(route('bank-transfers.to-hq.store'), [
            'from_acc' => $this->bank->id,
            'amount' => 30000,
            'to_acc' => 'disbursement',
            'charger_fee' => 500,
        ])->assertRedirect();

        $this->assertSame(69500.0, $this->bank->balance());
        $this->assertSame(30000.0, $this->ledger->balance($this->admin->company_id, Account::HqDisbursement));
    }

    public function test_foreign_transfers_are_not_reachable(): void
    {
        $foreignBranch = Branch::factory()->create();
        $foreignBank = BankAccount::create(['company_id' => $foreignBranch->company_id, 'name' => 'NMB']);
        $transfer = BankTransfer::create([
            'company_id' => $foreignBranch->company_id, 'type' => 'branch_to_bank', 'branch_id' => $foreignBranch->id,
            'branch_account' => Account::Principal->value, 'bank_account_id' => $foreignBank->id, 'amount' => 5000,
            'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->post(route('bank-transfers.approve', $transfer))->assertNotFound();
        $this->post(route('bank-transfers.store'), [
            'from_blanch_id' => $foreignBranch->id, 'ac_type' => 'principal', 'amount' => 10, 'to_account_id' => $foreignBank->id,
        ])->assertSessionHasErrors(['from_blanch_id', 'to_account_id']);
    }
}
