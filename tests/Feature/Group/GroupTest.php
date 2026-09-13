<?php

namespace Tests\Feature\Group;

use App\Models\Company;
use App\Models\Customer;
use App\Models\Group;
use App\Models\Loan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GroupTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_manage_groups(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('groups.store'), ['group_name' => 'wazuri'])->assertRedirect();
        $group = Group::where('name', 'wazuri')->firstOrFail();
        $this->assertSame($admin->company_id, $group->company_id);

        $this->get(route('groups.index'))->assertOk()->assertSee('Group List')->assertSee('wazuri');

        $this->put(route('groups.update', $group), ['group_name' => 'WAZURI'])->assertRedirect();
        $this->assertSame('WAZURI', $group->fresh()->name);

        $this->delete(route('groups.destroy', $group))->assertRedirect();
        $this->assertModelMissing($group);
    }

    public function test_group_customer_list_shows_members_and_loan_totals(): void
    {
        $admin = $this->signInAdmin();
        $group = Group::create(['company_id' => $admin->company_id, 'name' => 'wazuri']);
        $member = Customer::factory()->create(['branch_id' => $admin->branch_id, 'group_id' => $group->id]);
        Loan::factory()->create(['customer_id' => $member->id, 'total_payable' => 408000, 'restoration' => 136000]);
        $loanMember = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        Loan::factory()->create(['customer_id' => $loanMember->id, 'group_id' => $group->id]);
        $outsider = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        Loan::factory()->create(['customer_id' => $outsider->id]);

        $this->get(route('groups.show', $group))
            ->assertOk()
            ->assertSee('Customer List / wazuri')
            ->assertSee($member->full_name)
            ->assertSee('408,000')
            ->assertSee($loanMember->full_name)
            ->assertViewHas('loans', fn ($loans): bool => $loans->where('customer_id', $outsider->id)->isEmpty());
    }

    public function test_groups_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = Group::create(['company_id' => Company::factory()->create()->id, 'name' => 'other']);

        $this->get(route('groups.show', $foreign))->assertNotFound();
        $this->delete(route('groups.destroy', $foreign))->assertNotFound();
    }
}
