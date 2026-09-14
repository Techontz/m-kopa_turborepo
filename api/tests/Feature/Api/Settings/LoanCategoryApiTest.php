<?php

namespace Tests\Feature\Api\Settings;

use App\Models\Branch;
use App\Models\Company;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\InterestFormula;
use App\Models\LoanCategory;
use App\Models\MainCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoanCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        InterestFormula::create(['code' => 'SIMPLE', 'name' => 'SIMPLE FORMULAR', 'is_enabled' => true]);
        InterestFormula::create(['code' => 'FLAT', 'name' => 'FLAT RATE FORMULAR', 'is_enabled' => false]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Employee $admin, array $overrides = []): array
    {
        $main = MainCategory::firstOrCreate(['company_id' => $admin->company_id, 'code' => 'ser'], ['name' => 'WAJASILIAMALI']);

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
            'requires_mandate' => 'YES',
            'topup_percent' => '50',
            'take_home_percent' => '70',
            'main_id' => $main->id,
        ], $overrides);
    }

    private function customerCategory(Employee $admin, string $key = 'mtumishi_umma'): CustomerCategory
    {
        return CustomerCategory::create([
            'company_id' => $admin->company_id, 'key' => $key, 'name' => 'Mtumishi wa Umma', 'risk_level' => 'low',
            'min_loan_amount' => 100000, 'max_loan_amount' => 10000000, 'required_documents' => ['NIDA'], 'form_schema' => [],
        ]);
    }

    public function test_admin_creates_lists_updates_and_deletes_a_loan_category(): void
    {
        $admin = $this->signInAdmin();
        $category = $this->customerCategory($admin);

        $this->postJson('/api/v1/settings/loan-categories', $this->payload($admin, ['customer_category_ids' => [$category->id]]))
            ->assertCreated()
            ->assertJsonPath('message', 'Loan Category Registered successfully')
            ->assertJsonPath('data.requires_mandate', true)
            ->assertJsonPath('data.customer_categories.0.id', $category->id);

        $loanCategory = LoanCategory::firstWhere('name', 'BIASHARA');
        $this->assertSame(2000000.0, (float) $loanCategory->amount_to);

        $this->getJson('/api/v1/settings/loan-categories')
            ->assertOk()
            ->assertJsonPath('data.0.level_label', '20,000 - 2,000,000')
            ->assertJsonPath('data.0.main_category', 'WAJASILIAMALI');

        $this->putJson("/api/v1/settings/loan-categories/{$loanCategory->id}", $this->payload($admin, ['loan_name' => 'BIASHARA 2', 'requires_mandate' => 'NO', 'customer_category_ids' => []]))
            ->assertOk();
        $this->assertFalse($loanCategory->fresh()->requires_mandate);
        $this->assertSame(0, $loanCategory->customerCategories()->count());

        $this->deleteJson("/api/v1/settings/loan-categories/{$loanCategory->id}")->assertOk();
        $this->assertModelMissing($loanCategory);
    }

    public function test_freeze_time_is_stored_returned_editable_and_validated(): void
    {
        $admin = $this->signInAdmin();
        $admin->company->update(['loan_freeze_days' => 5]);

        $this->postJson('/api/v1/settings/loan-categories', $this->payload($admin, ['freeze_time_days' => 30]))
            ->assertCreated()
            ->assertJsonPath('data.freeze_time_days', 30);
        $category = LoanCategory::firstWhere('name', 'BIASHARA');
        $this->assertSame(30, $category->freeze_time_days);

        $this->getJson('/api/v1/settings/loan-categories')->assertOk()->assertJsonPath('data.0.freeze_time_days', 30);
        $this->getJson("/api/v1/settings/loan-categories/{$category->id}")->assertOk()->assertJsonPath('data.freeze_time_days', 30);

        $this->putJson("/api/v1/settings/loan-categories/{$category->id}", $this->payload($admin, ['freeze_time_days' => 0]))
            ->assertOk()
            ->assertJsonPath('data.freeze_time_days', 0);
        $this->putJson("/api/v1/settings/loan-categories/{$category->id}", $this->payload($admin, ['freeze_time_days' => 12]))->assertOk();
        $this->putJson("/api/v1/settings/loan-categories/{$category->id}", $this->payload($admin))->assertOk();
        $this->assertSame(12, $category->fresh()->freeze_time_days, 'Omitting the field keeps the stored value.');

        $this->postJson('/api/v1/settings/loan-categories', $this->payload($admin, ['loan_name' => 'DEFAULTED']))->assertCreated()->assertJsonPath('data.freeze_time_days', 5);

        foreach ([-1, 366, 'abc', 1.5] as $invalid) {
            $this->putJson("/api/v1/settings/loan-categories/{$category->id}", $this->payload($admin, ['freeze_time_days' => $invalid]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('freeze_time_days');
        }
        $this->assertSame(12, $category->fresh()->freeze_time_days);
    }

    public function test_validation_rejects_disabled_formula_bad_range_and_foreign_customer_category(): void
    {
        $admin = $this->signInAdmin();
        $foreign = CustomerCategory::create([
            'company_id' => Company::factory()->create()->id, 'key' => 'x', 'name' => 'X', 'required_documents' => [], 'form_schema' => [],
        ]);

        $this->postJson('/api/v1/settings/loan-categories', $this->payload($admin, ['formular' => 'FLAT', 'loan_perday' => '100', 'requires_mandate' => 'MAYBE', 'customer_category_ids' => [$foreign->id]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['formular', 'loan_perday', 'requires_mandate', 'customer_category_ids.0']);
    }

    public function test_branch_assignment_and_isolation(): void
    {
        $admin = $this->signInAdmin();
        $loanCategory = LoanCategory::factory()->create(['company_id' => $admin->company_id]);
        $foreignBranch = Branch::factory()->create();

        $this->postJson("/api/v1/settings/loan-categories/{$loanCategory->id}/branches/{$admin->branch_id}")->assertOk()->assertJsonPath('message', 'Branch Added successfully');
        $this->assertTrue($loanCategory->branches()->whereKey($admin->branch_id)->exists());

        $this->postJson("/api/v1/settings/loan-categories/{$loanCategory->id}/branches/{$foreignBranch->id}")->assertNotFound();

        $this->deleteJson("/api/v1/settings/loan-categories/{$loanCategory->id}/branches/{$admin->branch_id}")->assertOk();
        $this->assertFalse($loanCategory->branches()->exists());

        $foreignCategory = LoanCategory::factory()->create();
        $this->putJson("/api/v1/settings/loan-categories/{$foreignCategory->id}", $this->payload($admin))->assertNotFound();

        $officer = Employee::factory()->create([
            'company_id' => $admin->company_id, 'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', 'loan_officer')->value('id'),
        ]);
        $this->actingAs($officer)->postJson('/api/v1/settings/loan-categories', $this->payload($admin))->assertForbidden();
    }
}
