<?php

namespace Tests\Feature\Settings;

use App\Models\Company;
use App\Models\MainCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MainCategoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_main_category_page_lists_categories(): void
    {
        $admin = $this->signInAdmin();
        MainCategory::create(['company_id' => $admin->company_id, 'code' => 'ent', 'name' => 'WATUMISHI']);

        $this->get(route('main-categories.index'))
            ->assertOk()
            ->assertSee('Category List')
            ->assertSee('WATUMISHI');
    }

    public function test_admin_can_toggle_a_main_category(): void
    {
        $admin = $this->signInAdmin();
        $category = MainCategory::create(['company_id' => $admin->company_id, 'code' => 'ent', 'name' => 'WATUMISHI']);

        $this->delete(route('main-categories.disable', $category))->assertRedirect();
        $this->assertFalse($category->fresh()->is_enabled);

        $this->post(route('main-categories.enable', $category))->assertRedirect();
        $this->assertTrue($category->fresh()->is_enabled);
    }

    public function test_sub_category_page_toggles_customer_types_used_by_registration_lookup(): void
    {
        $admin = $this->signInAdmin();
        $category = MainCategory::create(['company_id' => $admin->company_id, 'code' => 'ent', 'name' => 'WATUMISHI']);
        $hazina = $category->customerTypes()->create(['code' => 'hazina', 'name' => 'HAZINA', 'is_enabled' => false]);

        $this->get(route('main-categories.types', $category))
            ->assertOk()
            ->assertSee('Sub category Loan / WATUMISHI LOAN')
            ->assertSee('HAZINA');

        $this->get(route('lookup.customer-types', ['work_status' => 'ent']))->assertDontSee('HAZINA');

        $this->post(route('customer-types.enable', $hazina))->assertRedirect();
        $this->assertTrue($hazina->fresh()->is_enabled);
        $this->get(route('lookup.customer-types', ['work_status' => 'ent']))->assertSee('HAZINA');

        $this->delete(route('customer-types.disable', $hazina))->assertRedirect();
        $this->assertFalse($hazina->fresh()->is_enabled);
    }

    public function test_customer_types_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = MainCategory::create(['company_id' => Company::factory()->create()->id, 'code' => 'ent', 'name' => 'WATUMISHI']);
        $type = $foreign->customerTypes()->create(['code' => 'vip', 'name' => 'VIP', 'is_enabled' => true]);

        $this->get(route('main-categories.types', $foreign))->assertNotFound();
        $this->delete(route('customer-types.disable', $type))->assertNotFound();
        $this->assertTrue($type->fresh()->is_enabled);
    }
}
