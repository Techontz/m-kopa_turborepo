<?php

namespace Tests\Feature\Settings;

use App\Enums\Duration;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\InterestFormula;
use App\Models\LoanCategory;
use App\Models\MainCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoanCategoryTest extends TestCase
{
    use RefreshDatabase;

    private function mainCategory(Employee $admin): MainCategory
    {
        return MainCategory::create(['company_id' => $admin->company_id, 'code' => 'ser', 'name' => 'WAJASILIAMALI']);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(MainCategory $mainCategory, array $overrides = []): array
    {
        return array_merge([
            'loan_name' => 'BIASHARA',
            'loan_price' => '20,000',
            'loan_perday' => '2,000,000',
            'interest_formular' => '30',
            'formular' => 'SIMPLE',
            'duration' => 'weekly',
            'from_repayment' => 1,
            'to_repayment' => 3,
            'fee_deduct' => 'YES',
            'penart' => 'NO',
            'aprove_status' => 'hq',
            'topup_percent' => '50',
            'take_home_percent' => '70',
            'main_id' => $mainCategory->id,
        ], $overrides);
    }

    protected function setUp(): void
    {
        parent::setUp();

        InterestFormula::create(['code' => 'SIMPLE', 'name' => 'SIMPLE FORMULAR', 'is_enabled' => true]);
    }

    public function test_loan_category_page_lists_categories(): void
    {
        $admin = $this->signInAdmin();
        LoanCategory::factory()->create(['company_id' => $admin->company_id, 'name' => 'GROUP LOAN', 'main_category_id' => $this->mainCategory($admin)->id]);

        $this->get(route('loan-categories.index'))
            ->assertOk()
            ->assertSee('Loan Category List')
            ->assertSee('Create Loan Category')
            ->assertSee('GROUP LOAN')
            ->assertSee('20,000 - 2,000,000');
    }

    public function test_admin_can_create_a_loan_category(): void
    {
        $admin = $this->signInAdmin();
        $mainCategory = $this->mainCategory($admin);

        $this->post(route('loan-categories.store'), $this->payload($mainCategory))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $category = LoanCategory::where('company_id', $admin->company_id)->where('name', 'BIASHARA')->firstOrFail();
        $this->assertSame(20000.0, (float) $category->amount_from);
        $this->assertSame(2000000.0, (float) $category->amount_to);
        $this->assertSame(Duration::Weekly, $category->duration);
        $this->assertTrue($category->fee_deduct);
        $this->assertFalse($category->has_penalty);
        $this->assertSame($mainCategory->id, $category->main_category_id);
    }

    public function test_loan_category_validation_rejects_disabled_formula_and_bad_range(): void
    {
        $admin = $this->signInAdmin();
        InterestFormula::create(['code' => 'REDUCING', 'name' => 'REDUCING FORMULAR', 'is_enabled' => false]);

        $this->post(route('loan-categories.store'), $this->payload($this->mainCategory($admin), ['formular' => 'UNKNOWN', 'loan_perday' => '100']))
            ->assertSessionHasErrors(['formular', 'loan_perday']);
    }

    public function test_admin_can_edit_and_update_a_loan_category(): void
    {
        $admin = $this->signInAdmin();
        $mainCategory = $this->mainCategory($admin);
        $category = LoanCategory::factory()->create(['company_id' => $admin->company_id, 'main_category_id' => $mainCategory->id]);

        $this->get(route('loan-categories.edit', $category))->assertOk()->assertSee('Edit Loan Category');

        $this->put(route('loan-categories.update', $category), $this->payload($mainCategory, ['loan_name' => 'UPDATED', 'duration' => 'monthly']))
            ->assertRedirect(route('loan-categories.index'));

        $this->assertSame('UPDATED', $category->fresh()->name);
        $this->assertSame(Duration::Monthly, $category->fresh()->duration);
    }

    public function test_admin_can_assign_and_remove_branches(): void
    {
        $admin = $this->signInAdmin();
        $category = LoanCategory::factory()->create(['company_id' => $admin->company_id]);

        $this->get(route('loan-categories.branches', $category))
            ->assertOk()
            ->assertSee('Branch List Loan Category');

        $this->post(route('loan-categories.attach-branch', [$category, $admin->branch]))->assertRedirect();
        $this->assertTrue($category->branches()->whereKey($admin->branch_id)->exists());

        $this->delete(route('loan-categories.detach-branch', [$category, $admin->branch]))->assertRedirect();
        $this->assertFalse($category->branches()->whereKey($admin->branch_id)->exists());
    }

    public function test_admin_can_delete_a_loan_category(): void
    {
        $admin = $this->signInAdmin();
        $category = LoanCategory::factory()->create(['company_id' => $admin->company_id]);

        $this->delete(route('loan-categories.destroy', $category))->assertRedirect();

        $this->assertModelMissing($category);
    }

    public function test_loan_categories_of_other_companies_are_not_reachable(): void
    {
        $admin = $this->signInAdmin();
        $foreign = LoanCategory::factory()->create();
        $foreignBranch = Branch::factory()->create();

        $this->get(route('loan-categories.edit', $foreign))->assertNotFound();
        $this->get(route('loan-categories.branches', $foreign))->assertNotFound();
        $this->delete(route('loan-categories.destroy', $foreign))->assertNotFound();
        $this->post(route('loan-categories.attach-branch', [LoanCategory::factory()->create(['company_id' => $admin->company_id]), $foreignBranch]))->assertNotFound();

        $this->assertModelExists($foreign);
    }
}
