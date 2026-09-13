<?php

namespace Tests\Feature\Expenses;

use App\Models\Company;
use App\Models\ExpenseType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseTypeTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_three_registers_render_their_own_types(): void
    {
        $admin = $this->signInAdmin();
        ExpenseType::create(['company_id' => $admin->company_id, 'scope' => 'branch', 'name' => 'umeme']);
        ExpenseType::create(['company_id' => $admin->company_id, 'scope' => 'bank', 'name' => 'MISHAHARA']);

        $this->get(route('expense-types.branch'))->assertOk()->assertSee('umeme')->assertDontSee('MISHAHARA')->assertSee('name="ex_name"', false);
        $this->get(route('expense-types.hq'))->assertOk()->assertSee('Headquater Expenses')->assertSee('name="exp_desc"', false);
        $this->get(route('expense-types.bank'))->assertOk()->assertSee('Register Bank Expenses')->assertSee('MISHAHARA')->assertSee('name="expenses_name"', false);
    }

    public function test_types_can_be_created_updated_and_deleted_per_scope(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('expense-types.store'), ['scope' => 'hq', 'exp_desc' => 'MAFUTA'])->assertRedirect();
        $type = ExpenseType::where('company_id', $admin->company_id)->where('scope', 'hq')->firstOrFail();
        $this->assertSame('MAFUTA', $type->name);

        $this->put(route('expense-types.update', $type), ['scope' => 'hq', 'exp_desc' => 'DIESEL'])->assertRedirect();
        $this->assertSame('DIESEL', $type->fresh()->name);

        $this->delete(route('expense-types.destroy', $type))->assertRedirect();
        $this->assertModelMissing($type);
    }

    public function test_foreign_types_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = ExpenseType::create(['company_id' => Company::factory()->create()->id, 'scope' => 'branch', 'name' => 'umeme']);

        $this->delete(route('expense-types.destroy', $foreign))->assertNotFound();
        $this->assertModelExists($foreign);
    }
}
