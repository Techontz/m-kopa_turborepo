<?php

namespace Tests\Feature\Settings;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PenaltyAndReserveSettingTest extends TestCase
{
    use RefreshDatabase;

    public function test_penalty_setting_page_shows_current_setting(): void
    {
        $this->signInAdmin();

        $this->get(route('penalty-setting.edit'))
            ->assertOk()
            ->assertSee('Penart Setting')
            ->assertSee('PERCENTAGE VALUE')
            ->assertSee('20%');
    }

    public function test_admin_can_update_penalty_setting(): void
    {
        $admin = $this->signInAdmin();

        $this->put(route('penalty-setting.update'), ['action_penart' => 'MONEY VALUE', 'penart' => 5000])->assertRedirect();

        $company = $admin->company->fresh();
        $this->assertSame('money', $company->penalty_type);
        $this->assertSame(5000.0, (float) $company->penalty_value);
    }

    public function test_reserve_setting_page_renders_and_updates(): void
    {
        $admin = $this->signInAdmin();

        $this->get(route('reserve-setting.edit'))
            ->assertOk()
            ->assertSee('Reserve Setting')
            ->assertSee('Enter Recerve Percentage %');

        $this->put(route('reserve-setting.update'), ['reserve' => 15])->assertRedirect();
        $this->assertSame(15.0, (float) $admin->company->fresh()->reserve_percent);

        $this->put(route('reserve-setting.update'), ['reserve' => 150])->assertSessionHasErrors('reserve');
    }
}
