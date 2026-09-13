<?php

namespace Tests\Feature\Settings;

use App\Models\InterestFormula;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FormulaTest extends TestCase
{
    use RefreshDatabase;

    public function test_formula_page_lists_all_and_enabled_formulas(): void
    {
        $this->signInAdmin();
        InterestFormula::create(['code' => 'SIMPLE', 'name' => 'SIMPLE FORMULAR', 'is_enabled' => true]);
        InterestFormula::create(['code' => 'REDUCING', 'name' => 'REDUCING FORMULAR', 'is_enabled' => false]);

        $this->get(route('formulas.index'))
            ->assertOk()
            ->assertSee('Interest Formular')
            ->assertSee('SIMPLE FORMULAR')
            ->assertSee('REDUCING FORMULAR');
    }

    public function test_admin_can_enable_and_disable_a_formula(): void
    {
        $this->signInAdmin();
        $formula = InterestFormula::create(['code' => 'REDUCING', 'name' => 'REDUCING FORMULAR', 'is_enabled' => false]);

        $this->post(route('formulas.enable', $formula))->assertRedirect();
        $this->assertTrue($formula->fresh()->is_enabled);

        $this->delete(route('formulas.disable', $formula))->assertRedirect();
        $this->assertFalse($formula->fresh()->is_enabled);
    }
}
