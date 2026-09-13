<?php

namespace Tests\Feature\Api\Capital;

use App\Enums\Account;
use App\Models\Company;
use App\Models\Employee;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShareHolderCapitalApiTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function holderPayload(array $overrides = []): array
    {
        return array_merge(['share_name' => 'mseti', 'share_mobile' => '0777', 'share_email' => 'holder@example.com', 'share_sex' => 'male', 'share_dob' => '1992-12-12'], $overrides);
    }

    public function test_share_holder_crud(): void
    {
        $this->signInAdmin();

        $this->postJson('/api/v1/capital/share-holders', $this->holderPayload())->assertCreated()->assertJsonPath('message', 'Share Holder Registered successfully');
        $holder = ShareHolder::firstWhere('name', 'mseti');

        $this->putJson("/api/v1/capital/share-holders/{$holder->id}", $this->holderPayload(['share_name' => 'HABAKUKI']))->assertOk();
        $this->getJson('/api/v1/capital/share-holders')->assertOk()->assertJsonPath('data.0.name', 'HABAKUKI')->assertJsonPath('data.0.date_of_birth', '1992-12-12');

        $this->postJson('/api/v1/capital/share-holders', $this->holderPayload(['share_email' => 'bad', 'share_dob' => '']))
            ->assertUnprocessable()->assertJsonValidationErrors(['share_email', 'share_dob']);

        $this->deleteJson("/api/v1/capital/share-holders/{$holder->id}")->assertOk();
        $this->assertModelMissing($holder);
    }

    public function test_adding_capital_posts_to_company_account_and_blocks_holder_deletion(): void
    {
        $admin = $this->signInAdmin();
        $holder = ShareHolder::create(['company_id' => $admin->company_id, 'name' => 'mseti', 'mobile' => '0777', 'email' => 'a@example.com', 'date_of_birth' => '1990-01-01']);

        $this->postJson('/api/v1/capital/capitals', ['share_id' => $holder->id, 'amount' => 5000000, 'pay_method' => 'BANK', 'recept' => '12', 'chaque_no' => '99'])
            ->assertCreated()->assertJsonPath('message', 'Capital Added successfully');

        $ledger = app(Ledger::class);
        $this->assertSame(5000000.0, $ledger->balance($admin->company_id, Account::Company));
        $this->assertSame(5000000.0, $ledger->balance($admin->company_id, Account::Capital));

        $this->getJson('/api/v1/capital/capitals')->assertOk()
            ->assertJsonPath('data.share_holders.0.capitals.0.pay_method', 'BANK')
            ->assertJsonPath('data.share_holder_capital', 5000000)
            ->assertJsonPath('data.company_capital', 5000000);

        $this->deleteJson("/api/v1/capital/share-holders/{$holder->id}")->assertUnprocessable();

        $foreign = ShareHolder::create(['company_id' => Company::factory()->create()->id, 'name' => 'x', 'mobile' => '1', 'email' => 'x@example.com', 'date_of_birth' => '1990-01-01']);
        $this->postJson('/api/v1/capital/capitals', ['share_id' => $foreign->id, 'amount' => 1, 'pay_method' => 'CASH'])->assertUnprocessable()->assertJsonValidationErrors('share_id');
        $this->putJson("/api/v1/capital/share-holders/{$foreign->id}", $this->holderPayload())->assertNotFound();
    }

    public function test_capital_is_hidden_from_roles_without_capital_permissions(): void
    {
        $admin = $this->signInAdmin();
        $finance = Employee::factory()->create([
            'company_id' => $admin->company_id, 'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', 'admin')->value('id'),
        ]);

        $this->actingAs($finance)->getJson('/api/v1/capital/capitals')->assertForbidden();
        $this->actingAs($finance)->getJson('/api/v1/capital/share-holders')->assertForbidden();
    }
}
