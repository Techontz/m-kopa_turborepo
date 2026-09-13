<?php

namespace Tests\Feature\Api\Settings;

use App\Models\AuditLog;
use App\Models\Company;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\LoanCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    private function category(int $companyId): CustomerCategory
    {
        return CustomerCategory::create([
            'company_id' => $companyId, 'key' => 'mjasiriamali', 'name' => 'Mjasiriamali', 'risk_level' => 'high',
            'min_loan_amount' => 20000, 'max_loan_amount' => 2000000, 'required_documents' => ['NIDA'],
            'form_schema' => [['key' => 'biashara', 'label' => 'Aina ya Biashara', 'control' => 'select', 'required' => true]],
        ]);
    }

    public function test_admin_edits_category_rules_and_views_form_schema(): void
    {
        $admin = $this->signInAdmin();
        $category = $this->category($admin->company_id);
        $product = LoanCategory::factory()->create(['company_id' => $admin->company_id, 'name' => 'VIKUNDI 1']);

        $this->getJson('/api/v1/settings/customer-categories')->assertOk()->assertJsonPath('data.0.fields_count', 1)->assertJsonMissingPath('data.0.form_schema');
        $this->getJson("/api/v1/settings/customer-categories/{$category->id}")->assertOk()->assertJsonPath('data.form_schema.0.key', 'biashara');

        $this->putJson("/api/v1/settings/customer-categories/{$category->id}", [
            'name' => 'Mjasiriamali mdogo',
            'risk_level' => 'medium',
            'min_loan_amount' => '50,000',
            'max_loan_amount' => '3,000,000',
            'required_documents' => ['NIDA', 'Business licence', ' '],
            'loan_category_ids' => [$product->id],
            'is_active' => false,
        ])->assertOk()->assertJsonPath('message', 'Customer Category Updated successfully');

        $category->refresh();
        $this->assertSame('medium', $category->risk_level);
        $this->assertSame(3000000.0, (float) $category->max_loan_amount);
        $this->assertSame(['NIDA', 'Business licence'], $category->required_documents);
        $this->assertFalse($category->is_active);
        $this->assertTrue($category->loanCategories()->whereKey($product->id)->exists());
        $this->assertTrue(AuditLog::where('action', 'CustomerCategory.rules_updated')->exists());
    }

    public function test_validation_permission_and_isolation(): void
    {
        $admin = $this->signInAdmin();
        $category = $this->category($admin->company_id);

        $this->putJson("/api/v1/settings/customer-categories/{$category->id}", [
            'name' => 'X', 'risk_level' => 'extreme', 'min_loan_amount' => 500, 'max_loan_amount' => 100,
            'required_documents' => [], 'loan_category_ids' => [LoanCategory::factory()->create()->id], 'is_active' => true,
        ])->assertUnprocessable()->assertJsonValidationErrors(['risk_level', 'max_loan_amount', 'loan_category_ids.0']);

        $foreign = $this->category(Company::factory()->create()->id);
        $this->getJson("/api/v1/settings/customer-categories/{$foreign->id}")->assertNotFound();

        $manager = Employee::factory()->create([
            'company_id' => $admin->company_id, 'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', 'branch_manager')->value('id'),
        ]);
        $this->actingAs($manager)->getJson('/api/v1/settings/customer-categories')->assertForbidden();
    }
}
