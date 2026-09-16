<?php

namespace Tests\Feature\Api\Capital;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\FloatTransfer;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\UsesSecondApprover;
use Tests\TestCase;

class FloatApiTest extends TestCase
{
    use RefreshDatabase;
    use UsesSecondApprover;

    private function ledger(): Ledger
    {
        return app(Ledger::class);
    }

    /**
     * The company funds HQ only: Company A/C, a bank account or the Investment RESERVE A/C → the HQ PRINCIPAL A/C. A branch is
     * never a float destination (HQ/Finance funds and disburses loans) and an asset is never a source.
     */
    public function test_company_float_moves_a_chosen_source_to_the_hq_principal_account(): void
    {
        $admin = $this->signInAdmin();
        $this->ledger()->openingBalance($admin->company_id, Account::Company, 1000000, 'CAPITAL');

        // Rule 6: the float is requested (pending, nothing posted) and approved by another authorised user.
        $id = $this->postJson('/api/v1/capital/floats', ['amount' => 400000, 'from_account' => Account::Company->value])
            ->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');
        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::Principal));
        $this->assertSame(1000000.0, $this->ledger()->balance($admin->company_id, Account::Company), 'a pending float moves nothing');

        $this->asApprover($admin, fn () => $this->postJson("/api/v1/capital/floats/{$id}/approve")->assertOk()->assertJsonPath('message', 'Float Approved successfully'));

        $this->assertSame(600000.0, $this->ledger()->balance($admin->company_id, Account::Company));
        $this->assertSame(400000.0, $this->ledger()->balance($admin->company_id, Account::Principal), 'HQ PRINCIPAL A/C, no branch');
        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));

        $this->getJson('/api/v1/capital/floats')->assertOk()
            ->assertJsonPath('total', 400000)
            ->assertJsonPath('data.0.to_account', 'PRINCIPAL A/C')
            ->assertJsonPath('data.0.to_branch', null)
            ->assertJsonPath('sources.0.label', 'Company A/C')
            ->assertJsonPath('sources.0.balance', 600000);
        $this->getJson('/api/v1/capital/floats?from=2000-01-01&to=2000-01-02')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_company_float_sources_are_bank_and_investment_reserve_but_never_an_asset_or_more_than_the_balance(): void
    {
        $admin = $this->signInAdmin();
        $bank = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'NMB']);
        $this->ledger()->openingBalance($admin->company_id, Account::Bank, 250000, bankAccount: $bank);
        $this->ledger()->openingBalance($admin->company_id, Account::InvestmentReserve, 80000, 'RESERVE SENT TO INVESTMENT');

        $this->postJson('/api/v1/capital/floats', ['amount' => 1000, 'from_account' => Account::MotorVehicles->value])->assertUnprocessable()->assertJsonValidationErrors('from_account');
        $this->postJson('/api/v1/capital/floats', ['amount' => 1000, 'from_account' => Account::Bank->value])->assertUnprocessable()->assertJsonValidationErrors('bank_account_id');
        $this->postJson('/api/v1/capital/floats', ['amount' => 250001, 'from_account' => Account::Bank->value, 'bank_account_id' => $bank->id])->assertUnprocessable()->assertJsonValidationErrors('amount');

        $fromBank = $this->postJson('/api/v1/capital/floats', ['amount' => 150000, 'from_account' => Account::Bank->value, 'bank_account_id' => $bank->id])->assertCreated()->json('data.id');
        $fromReserve = $this->postJson('/api/v1/capital/floats', ['amount' => 80000, 'from_account' => Account::InvestmentReserve->value])->assertCreated()->json('data.id');
        $this->asApprover($admin, function () use ($fromBank, $fromReserve): void {
            $this->postJson("/api/v1/capital/floats/{$fromBank}/approve")->assertOk();
            $this->postJson("/api/v1/capital/floats/{$fromReserve}/approve")->assertOk();
        });

        $this->assertSame(100000.0, $this->ledger()->balance($admin->company_id, Account::Bank, bankAccount: $bank));
        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::InvestmentReserve));
        $this->assertSame(230000.0, $this->ledger()->balance($admin->company_id, Account::Principal));
    }

    public function test_branch_to_branch_request_approve_and_delete(): void
    {
        $admin = $this->signInAdmin();
        $kakonko = Branch::factory()->create(['company_id' => $admin->company_id, 'name' => 'Kakonko']);
        // Rule 6: an Admin requests, so the initiator is not the Super Admin (who approves their own items).
        $requester = $this->secondApprover($admin, 'admin');
        $this->actingAs($requester);

        $this->postJson('/api/v1/capital/floats/branch', ['from_blanch_id' => $admin->branch_id, 'to_blanch_id' => $admin->branch_id, 'trans_amount' => 100])
            ->assertUnprocessable()->assertJsonValidationErrors('to_blanch_id');

        $this->postJson('/api/v1/capital/floats/branch', ['from_blanch_id' => $admin->branch_id, 'to_blanch_id' => $kakonko->id, 'trans_amount' => 100000])
            ->assertCreated()->assertJsonPath('message', 'Float Transfer Requested successfully');
        $transfer = FloatTransfer::firstWhere('type', 'branch_to_branch');

        $this->getJson('/api/v1/capital/floats/branch')->assertOk()->assertJsonPath('data.0.status', 'pending');

        $approver = $this->secondApprover($admin);
        $this->postJson("/api/v1/capital/floats/branch/{$transfer->id}/approve")->assertForbidden();
        $this->asApprover($requester, fn () => $this->postJson("/api/v1/capital/floats/branch/{$transfer->id}/approve")->assertUnprocessable(), $approver);
        $this->ledger()->openingBalance($admin->company_id, Account::Principal, 250000, branch: $admin->branch_id);

        $this->asApprover($requester, fn () => $this->postJson("/api/v1/capital/floats/branch/{$transfer->id}/approve")->assertOk()->assertJsonPath('message', 'Float Approved successfully'), $approver);
        $this->assertSame(150000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));
        $this->assertSame(100000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $kakonko->id));

        $this->asApprover($requester, fn () => $this->postJson("/api/v1/capital/floats/branch/{$transfer->id}/approve")->assertUnprocessable(), $approver);
        $this->deleteJson("/api/v1/capital/floats/branch/{$transfer->id}")->assertUnprocessable();
        $this->getJson('/api/v1/capital/floats/approved')->assertOk()->assertJsonPath('data.0.from_branch', Branch::find($admin->branch_id)->name);

        $pending = FloatTransfer::create(['company_id' => $admin->company_id, 'type' => 'branch_to_branch', 'from_branch_id' => $kakonko->id, 'to_branch_id' => $admin->branch_id, 'amount' => 10, 'status' => 'pending', 'transfer_date' => today()]);
        $this->deleteJson("/api/v1/capital/floats/branch/{$pending->id}")->assertOk();
        $this->assertModelMissing($pending);
    }

    public function test_account_to_account_within_branch(): void
    {
        $admin = $this->signInAdmin();
        $this->ledger()->openingBalance($admin->company_id, Account::Interest, 80000, branch: $admin->branch_id);

        $this->postJson('/api/v1/capital/floats/accounts', ['blanch_id' => $admin->branch_id, 'from_acc' => 'INT', 'to_acc' => 'INT', 'amount' => 1])
            ->assertUnprocessable()->assertJsonValidationErrors('to_acc');
        $short = $this->postJson('/api/v1/capital/floats/accounts', ['blanch_id' => $admin->branch_id, 'from_acc' => 'PR', 'to_acc' => 'INT', 'amount' => 1])->assertCreated()->json('data.id');
        $this->asApprover($admin, fn () => $this->postJson("/api/v1/capital/floats/{$short}/approve")->assertUnprocessable()->assertJsonValidationErrors('transfer'));

        $id = $this->postJson('/api/v1/capital/floats/accounts', ['blanch_id' => $admin->branch_id, 'from_acc' => 'INT', 'to_acc' => 'PR', 'amount' => 30000])->assertCreated()->json('data.id');
        $this->asApprover($admin, fn () => $this->postJson("/api/v1/capital/floats/{$id}/approve")->assertOk());

        $this->assertSame(50000.0, $this->ledger()->balance($admin->company_id, Account::Interest, $admin->branch_id));
        $this->assertSame(30000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));
        $this->getJson('/api/v1/capital/floats/accounts')->assertOk()->assertJsonPath('data.1.from_account', 'INTEREST A/C')->assertJsonPath('total', 30000)->assertJsonPath('total_pending', 1);
    }

    public function test_permission_scope_and_isolation(): void
    {
        $admin = $this->signInAdmin();
        $otherCompanyTransfer = FloatTransfer::create(['company_id' => Company::factory()->create()->id, 'type' => 'branch_to_branch', 'amount' => 1, 'status' => 'pending', 'transfer_date' => today()]);
        $this->postJson("/api/v1/capital/floats/branch/{$otherCompanyTransfer->id}/approve")->assertNotFound();
        $this->postJson('/api/v1/capital/floats', ['amount' => 1, 'from_account' => Account::Principal->value])->assertUnprocessable()->assertJsonValidationErrors('from_account');

        $roles = $admin->company->roles()->pluck('id', 'key');
        $teller = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'role_id' => $roles['teller']]);
        $this->actingAs($teller)->getJson('/api/v1/capital/floats/branch')->assertForbidden();

        $branchA = Branch::factory()->create(['company_id' => $admin->company_id]);
        $branchB = Branch::factory()->create(['company_id' => $admin->company_id]);
        FloatTransfer::create(['company_id' => $admin->company_id, 'type' => 'branch_to_branch', 'from_branch_id' => $branchA->id, 'to_branch_id' => $branchB->id, 'amount' => 5, 'status' => 'pending', 'transfer_date' => today()]);
        $manager = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'role_id' => $roles['branch_manager']]);
        $manager->role->permissions()->create(['permission' => 'float.manage']);

        $this->actingAs($manager->fresh())->getJson('/api/v1/capital/floats/branch')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($manager->fresh())->postJson('/api/v1/capital/floats/branch', ['from_blanch_id' => $branchA->id, 'to_blanch_id' => $branchB->id, 'trans_amount' => 5])->assertForbidden();
    }
}
