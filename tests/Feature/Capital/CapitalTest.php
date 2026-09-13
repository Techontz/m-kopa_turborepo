<?php

namespace Tests\Feature\Capital;

use App\Enums\Account;
use App\Models\Capital;
use App\Models\Company;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CapitalTest extends TestCase
{
    use RefreshDatabase;

    private function shareHolder(int $companyId): ShareHolder
    {
        return ShareHolder::create(['company_id' => $companyId, 'name' => 'mseti', 'mobile' => '0777', 'email' => 'a@example.com', 'date_of_birth' => '1992-12-12']);
    }

    public function test_capital_page_renders(): void
    {
        $admin = $this->signInAdmin();
        $this->shareHolder($admin->company_id);

        $this->get(route('capitals.index'))
            ->assertOk()
            ->assertSee('Add Capital')
            ->assertSee('SHARE HOLDER CAPITAL')
            ->assertSee('TOTAL COMPANY CAPITAL')
            ->assertSee('mseti');
    }

    public function test_storing_capital_posts_to_company_account(): void
    {
        $admin = $this->signInAdmin();
        $shareHolder = $this->shareHolder($admin->company_id);

        $this->post(route('capitals.store'), [
            'share_id' => $shareHolder->id,
            'amount' => 6000000,
            'pay_method' => 'CASH',
            'recept' => '123',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $capital = Capital::where('share_holder_id', $shareHolder->id)->firstOrFail();
        $this->assertSame('123', $capital->receipt_number);
        $this->assertSame(6000000.0, app(Ledger::class)->balance($admin->company_id, Account::Company));
        $this->assertDatabaseHas('ledger_entries', ['reference_type' => $capital->getMorphClass(), 'reference_id' => $capital->id, 'account' => 'company']);

        $this->get(route('capitals.index'))->assertSee('6,000,000');
    }

    public function test_capital_cannot_be_added_for_other_company_share_holder(): void
    {
        $this->signInAdmin();
        $foreign = $this->shareHolder(Company::factory()->create()->id);

        $this->post(route('capitals.store'), ['share_id' => $foreign->id, 'amount' => 1000, 'pay_method' => 'CASH'])
            ->assertSessionHasErrors('share_id');

        $this->assertDatabaseCount('capitals', 0);
    }
}
