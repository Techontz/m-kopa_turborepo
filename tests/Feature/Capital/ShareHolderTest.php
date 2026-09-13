<?php

namespace Tests\Feature\Capital;

use App\Models\Company;
use App\Models\ShareHolder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShareHolderTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'share_name' => 'mseti',
            'share_mobile' => '0777',
            'share_email' => 'holder@example.com',
            'share_sex' => 'male',
            'share_dob' => '1992-12-12',
        ], $overrides);
    }

    public function test_share_holder_page_lists_share_holders(): void
    {
        $admin = $this->signInAdmin();
        ShareHolder::create(['company_id' => $admin->company_id, 'name' => 'mseti', 'mobile' => '0777', 'email' => 'a@example.com', 'gender' => 'male', 'date_of_birth' => '1992-12-12']);

        $this->get(route('share-holders.index'))
            ->assertOk()
            ->assertSee('Register Share Holder')
            ->assertSee('Share Holder List')
            ->assertSee('mseti')
            ->assertSee('1992-12-12');
    }

    public function test_admin_can_register_update_and_delete_a_share_holder(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('share-holders.store'), $this->payload())->assertRedirect()->assertSessionHasNoErrors();
        $shareHolder = ShareHolder::where('company_id', $admin->company_id)->where('name', 'mseti')->firstOrFail();

        $this->put(route('share-holders.update', $shareHolder), $this->payload(['share_name' => 'John', 'share_sex' => 'female']))->assertRedirect();
        $this->assertSame('John', $shareHolder->fresh()->name);
        $this->assertSame('female', $shareHolder->fresh()->gender);

        $this->delete(route('share-holders.destroy', $shareHolder))->assertRedirect();
        $this->assertModelMissing($shareHolder);
    }

    public function test_share_holders_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = ShareHolder::create(['company_id' => Company::factory()->create()->id, 'name' => 'x', 'mobile' => '1', 'email' => 'x@example.com', 'date_of_birth' => '1990-01-01']);

        $this->put(route('share-holders.update', $foreign), $this->payload())->assertNotFound();
        $this->delete(route('share-holders.destroy', $foreign))->assertNotFound();
        $this->assertModelExists($foreign);
    }
}
