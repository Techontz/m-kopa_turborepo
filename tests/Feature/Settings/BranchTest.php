<?php

namespace Tests\Feature\Settings;

use App\Models\Branch;
use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BranchTest extends TestCase
{
    use RefreshDatabase;

    public function test_branch_page_lists_company_branches(): void
    {
        $admin = $this->signInAdmin();

        $this->get(route('branches.index'))
            ->assertOk()
            ->assertSee('Register Branch')
            ->assertSee($admin->branch->name);
    }

    public function test_admin_can_register_a_branch(): void
    {
        $admin = $this->signInAdmin();
        $region = Region::create(['name' => 'Mwanza']);

        $this->post(route('branches.store'), [
            'blanch_name' => 'Ilemela',
            'region_id' => $region->id,
            'blanch_no' => '0711000000',
            'branch_type' => 'sub',
        ])->assertRedirect();

        $this->assertDatabaseHas('branches', ['company_id' => $admin->company_id, 'name' => 'Ilemela', 'type' => 'sub']);
    }

    public function test_branches_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreignBranch = Branch::factory()->create();

        $this->delete(route('branches.destroy', $foreignBranch))->assertNotFound();
        $this->assertModelExists($foreignBranch);
    }
}
