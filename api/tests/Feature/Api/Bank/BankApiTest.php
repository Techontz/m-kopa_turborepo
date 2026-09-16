<?php

namespace Tests\Feature\Api\Bank;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\SalaryPayment;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\UsesSecondApprover;
use Tests\TestCase;

class BankApiTest extends TestCase
{
    use RefreshDatabase;
    use UsesSecondApprover;

    private Employee $admin;

    private Ledger $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->ledger = app(Ledger::class);
    }

    public function test_account_is_registered_with_opening_balance_updated_listed_and_deleted(): void
    {
        $this->postJson('/api/v1/bank/accounts', ['ac_name' => 'NMB', 'opening_balance' => 16200])
            ->assertCreated()
            ->assertJsonPath('message', 'Account Registered successfully');

        $account = BankAccount::firstOrFail();
        $this->assertSame(16200.0, $account->balance());
        $this->assertSame(16200.0, $this->ledger->balance($this->admin->company_id, Account::Capital));

        $this->putJson("/api/v1/bank/accounts/{$account->id}", ['ac_name' => 'NMB BANK'])->assertOk()->assertJsonPath('data.name', 'NMB BANK');
        $this->getJson('/api/v1/bank/balances')->assertOk()->assertJsonPath('data.0.balance', 16200)->assertJsonPath('total', 16200);
        $this->getJson('/api/v1/bank/options/accounts')->assertOk()->assertJsonPath('data.0.label', 'NMB BANK - 16,200');

        $this->deleteJson("/api/v1/bank/accounts/{$account->id}")->assertUnprocessable();

        $empty = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'CRDB']);
        $this->deleteJson("/api/v1/bank/accounts/{$empty->id}")->assertOk();
        $this->assertModelMissing($empty);
    }

    public function test_validation_and_permission(): void
    {
        $this->postJson('/api/v1/bank/accounts', [])->assertUnprocessable()->assertJsonValidationErrors('ac_name');

        $this->actingAs($this->employeeWithRole('loan_officer'));
        $this->getJson('/api/v1/bank/accounts')->assertForbidden();
        $this->postJson('/api/v1/bank/transfers', [])->assertForbidden();
    }

    public function test_branch_to_bank_transaction_is_requested_then_approved(): void
    {
        $bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $this->ledger->openingBalance($this->admin->company_id, Account::LoanFee, 150000, branch: $this->admin->branch_id);
        $requester = $this->employeeWithRole('admin');
        $this->actingAs($requester);

        $this->postJson('/api/v1/bank/transfers', [
            'from_blanch_id' => $this->admin->branch_id, 'ac_type' => Account::LoanFee->value, 'amount' => 110000, 'to_account_id' => $bank->id,
        ])->assertCreated()->assertJsonPath('message', 'Transaction Sent successfully');

        $transfer = BankTransfer::firstOrFail();
        $this->assertSame(0.0, $bank->balance());
        $this->getJson('/api/v1/bank/transfers')->assertOk()->assertJsonPath('data.0.branch_account_label', 'LOAN FEE A/C')->assertJsonPath('total', 0)->assertJsonPath('total_pending', 110000);

        // Rule 6: the requester cannot approve; a second authorised user does.
        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/approve")->assertForbidden();
        $approver = $this->secondApprover($this->admin);
        $this->asApprover($requester, fn () => $this->postJson("/api/v1/bank/transfers/{$transfer->id}/approve")->assertOk()->assertJsonPath('message', 'Transaction Approved successfully'), $approver);

        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(110000.0, $bank->balance());
        $this->assertSame(40000.0, $this->ledger->balance($this->admin->company_id, Account::LoanFee, $this->admin->branch_id));

        $this->asApprover($requester, fn () => $this->postJson("/api/v1/bank/transfers/{$transfer->id}/approve")->assertUnprocessable(), $approver);
        $this->deleteJson("/api/v1/bank/transfers/{$transfer->id}")->assertUnprocessable();
        $this->getJson('/api/v1/bank/transfers?status=approved&branch_id=all&from='.today()->toDateString().'&to='.today()->toDateString())->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/bank/transfers?status=approved&from=2020-01-01&to=2020-01-02')->assertJsonCount(0, 'data');
    }

    public function test_approval_fails_on_insufficient_branch_balance_and_pending_can_be_deleted(): void
    {
        $bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $transfer = BankTransfer::create([
            'company_id' => $this->admin->company_id, 'type' => 'branch_to_bank', 'branch_id' => $this->admin->branch_id,
            'branch_account' => Account::Interest->value, 'bank_account_id' => $bank->id, 'amount' => 5000, 'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->postJson("/api/v1/bank/transfers/{$transfer->id}/approve")->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertSame('pending', $transfer->fresh()->status);

        $this->deleteJson("/api/v1/bank/transfers/{$transfer->id}")->assertOk();
        $this->assertModelMissing($transfer);
    }

    /**
     * A bank account funds HQ accounts only — nothing funds a branch, which holds no lending money.
     */
    public function test_bank_to_hq_moves_money_with_charges(): void
    {
        $bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $this->ledger->openingBalance($this->admin->company_id, Account::Bank, 100000, bankAccount: $bank);

        $this->postJson('/api/v1/bank/to-branch', ['from_account' => $bank->id, 'to_blanch' => $this->admin->branch_id, 'amount' => 50000, 'charger_fee' => 1000])->assertNotFound();

        $toHq = $this->postJson('/api/v1/bank/to-hq', ['from_acc' => $bank->id, 'amount' => 40000, 'to_acc' => 'salary', 'charger_fee' => 500])->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');
        $this->assertSame(100000.0, $bank->balance(), 'a pending transfer moves nothing');
        $this->approveAsSecondUser($this->admin, "/api/v1/bank/transfers/{$toHq}/approve");
        $this->assertSame(59500.0, $bank->balance());
        $this->assertSame(40000.0, $this->ledger->balance($this->admin->company_id, Account::HqSalaryAdvance));
        $this->assertSame(500.0, $this->ledger->balance($this->admin->company_id, Account::BankCharges, allBranches: true));
        $this->getJson('/api/v1/bank/to-hq')->assertOk()->assertJsonPath('data.0.hq_account_label', 'SALARY ADVANCE ACCOUNT')->assertJsonPath('total_charge', 500);

        $tooMuch = $this->postJson('/api/v1/bank/to-hq', ['from_acc' => $bank->id, 'amount' => 60000, 'to_acc' => 'disbursement', 'charger_fee' => 0])->assertCreated()->json('data.id');
        $this->asApprover($this->admin, fn () => $this->postJson("/api/v1/bank/transfers/{$tooMuch}/approve")->assertUnprocessable()->assertJsonValidationErrors('amount'));
        $this->assertSame(59500.0, $bank->balance());
    }

    public function test_branch_scope_is_enforced_for_client_supplied_branch(): void
    {
        $otherBranch = Branch::factory()->create(['company_id' => $this->admin->company_id]);
        $bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $role = $this->admin->company->roles()->where('key', 'branch_manager')->firstOrFail();
        $role->permissions()->create(['permission' => 'bank.manage']);
        $this->actingAs($this->employeeWithRole('branch_manager'));

        $this->postJson('/api/v1/bank/transfers', [
            'from_blanch_id' => $otherBranch->id, 'ac_type' => Account::Interest->value, 'amount' => 100, 'to_account_id' => $bank->id,
        ])->assertForbidden();

        BankTransfer::create([
            'company_id' => $this->admin->company_id, 'type' => 'branch_to_bank', 'branch_id' => $otherBranch->id,
            'branch_account' => Account::Interest->value, 'bank_account_id' => $bank->id, 'amount' => 5000, 'status' => 'pending', 'transfer_date' => today(),
        ]);
        $this->getJson('/api/v1/bank/transfers')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_payroll_list_and_detail(): void
    {
        foreach ([84000, 8000] as $takeHome) {
            SalaryPayment::create([
                'company_id' => $this->admin->company_id, 'employee_id' => $this->admin->id, 'salary' => 100000,
                'take_home' => $takeHome, 'paid_from_account' => 'INTEREST A/C', 'paid_on' => '2024-05-21',
                'phone' => '0711', 'account_name' => 'CRDB', 'account_number' => '898657465',
            ]);
        }

        $this->getJson('/api/v1/bank/payroll')->assertOk()->assertJsonPath('data.0.amount', 92000)->assertJsonPath('data.0.date', '2024-05-21');
        $this->getJson('/api/v1/bank/payroll/2024-05-21')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.account_number', '898657465');
        $this->getJson('/api/v1/bank/payroll/not-a-date')->assertNotFound();

        $this->postJson('/api/v1/bank/payroll/pay')->assertStatus(405);
    }

    private function employeeWithRole(string $key): Employee
    {
        return Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'role_id' => $this->admin->company->roles()->where('key', $key)->value('id'),
        ]);
    }
}
