<?php

namespace Tests\Feature\Capital;

use App\Enums\Account;
use App\Models\Branch;
use App\Models\FloatTransfer;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FloatTest extends TestCase
{
    use RefreshDatabase;

    private function ledger(): Ledger
    {
        return app(Ledger::class);
    }

    public function test_float_pages_render(): void
    {
        $this->signInAdmin();

        $this->get(route('floats.company'))->assertOk()->assertSee('Transifor Float Form')->assertSee('Today Transaction');
        $this->get(route('floats.branch'))->assertOk()->assertSee('Transaction List')->assertSee('Transfar float');
        $this->get(route('floats.approved'))->assertOk()->assertSee('Transaction List Aproved');
        $this->get(route('floats.accounts'))->assertOk()->assertSee('Transifor Float From Ac-Ac');
    }

    public function test_company_float_moves_company_balance_to_branch_principal(): void
    {
        $admin = $this->signInAdmin();
        $this->ledger()->openingBalance($admin->company_id, Account::Company, 1000000, 'CAPITAL');

        $this->post(route('floats.company.store'), ['blanch_amount' => 400000, 'blanch_id' => $admin->branch_id])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertSame(600000.0, $this->ledger()->balance($admin->company_id, Account::Company));
        $this->assertSame(400000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));
        $this->assertDatabaseHas('float_transfers', ['type' => 'company_to_branch', 'status' => 'approved', 'to_branch_id' => $admin->branch_id]);

        $this->get(route('floats.company'))->assertSee('400,000');
    }

    public function test_company_float_requires_sufficient_company_balance(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('floats.company.store'), ['blanch_amount' => 400000, 'blanch_id' => $admin->branch_id])
            ->assertSessionHas('error');

        $this->assertDatabaseCount('float_transfers', 0);
    }

    public function test_branch_to_branch_float_is_pending_until_approved(): void
    {
        $admin = $this->signInAdmin();
        $toBranch = Branch::factory()->create(['company_id' => $admin->company_id, 'name' => 'Kakonko']);
        $this->ledger()->openingBalance($admin->company_id, Account::Principal, 300000, 'FLOAT', $admin->branch_id);

        $this->post(route('floats.branch.store'), ['from_blanch_id' => $admin->branch_id, 'to_blanch_id' => $toBranch->id, 'trans_amount' => 100000])
            ->assertRedirect();

        $transfer = FloatTransfer::where('type', 'branch_to_branch')->firstOrFail();
        $this->assertSame('pending', $transfer->status);
        $this->assertSame(0.0, $this->ledger()->balance($admin->company_id, Account::Principal, $toBranch));
        $this->get(route('floats.branch'))->assertSee('Kakonko')->assertSee('100,000');

        $this->post(route('floats.approve', $transfer))->assertRedirect()->assertSessionHas('success');

        $this->assertSame('approved', $transfer->fresh()->status);
        $this->assertSame(200000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));
        $this->assertSame(100000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $toBranch));
        $this->get(route('floats.approved'))->assertSee('Kakonko');

        $this->delete(route('floats.destroy', $transfer))->assertSessionHas('error');
        $this->assertModelExists($transfer);
    }

    public function test_branch_to_branch_validation_and_delete(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('floats.branch.store'), ['from_blanch_id' => $admin->branch_id, 'to_blanch_id' => $admin->branch_id, 'trans_amount' => 100])
            ->assertSessionHasErrors('to_blanch_id');

        $transfer = FloatTransfer::create([
            'company_id' => $admin->company_id, 'type' => 'branch_to_branch', 'from_branch_id' => $admin->branch_id,
            'to_branch_id' => Branch::factory()->create(['company_id' => $admin->company_id])->id,
            'amount' => 5000, 'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->post(route('floats.approve', $transfer))->assertSessionHas('error');
        $this->assertSame('pending', $transfer->fresh()->status);

        $this->delete(route('floats.destroy', $transfer))->assertRedirect();
        $this->assertModelMissing($transfer);
    }

    public function test_account_to_account_transfer_within_branch(): void
    {
        $admin = $this->signInAdmin();
        $this->ledger()->openingBalance($admin->company_id, Account::Principal, 50000, 'FLOAT', $admin->branch_id);

        $this->post(route('floats.accounts.store'), ['blanch_id' => $admin->branch_id, 'from_acc' => 'PR', 'to_acc' => 'PR', 'amount' => 100])
            ->assertSessionHasErrors('to_acc');

        $this->post(route('floats.accounts.store'), ['blanch_id' => $admin->branch_id, 'from_acc' => 'INT', 'to_acc' => 'PR', 'amount' => 100])
            ->assertSessionHas('error');

        $this->post(route('floats.accounts.store'), ['blanch_id' => $admin->branch_id, 'from_acc' => 'PR', 'to_acc' => 'INT', 'amount' => 20000])
            ->assertSessionHas('success');

        $this->assertSame(30000.0, $this->ledger()->balance($admin->company_id, Account::Principal, $admin->branch_id));
        $this->assertSame(20000.0, $this->ledger()->balance($admin->company_id, Account::Interest, $admin->branch_id));
    }

    public function test_floats_of_other_companies_are_not_reachable(): void
    {
        $admin = $this->signInAdmin();
        $foreignBranch = Branch::factory()->create();
        $foreign = FloatTransfer::create([
            'company_id' => $foreignBranch->company_id, 'type' => 'branch_to_branch', 'from_branch_id' => $foreignBranch->id,
            'to_branch_id' => $foreignBranch->id, 'amount' => 5000, 'status' => 'pending', 'transfer_date' => today(),
        ]);

        $this->post(route('floats.approve', $foreign))->assertNotFound();
        $this->delete(route('floats.destroy', $foreign))->assertNotFound();
        $this->post(route('floats.company.store'), ['blanch_amount' => 1, 'blanch_id' => $foreignBranch->id])->assertSessionHasErrors('blanch_id');

        $this->assertModelExists($foreign);
        $this->assertSame('pending', $foreign->fresh()->status);
        $this->assertNotNull($admin);
    }
}
