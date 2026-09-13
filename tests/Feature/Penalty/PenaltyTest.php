<?php

namespace Tests\Feature\Penalty;

use App\Enums\Account;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\Penalty;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PenaltyTest extends TestCase
{
    use RefreshDatabase;

    public function test_penalty_list_shows_only_unpaid_and_not_waived_penalties(): void
    {
        $admin = $this->signInAdmin();
        $open = $this->penaltyFor($admin, 30266);
        $this->penaltyFor($admin, 5000, ['is_waived' => true]);
        $this->penaltyFor($admin, 7000, ['paid_amount' => 7000]);

        $this->get(route('penalties.index'))
            ->assertOk()
            ->assertSee('Penarty List')
            ->assertSee($open->customer->full_name)
            ->assertSee('30,266')
            ->assertViewHas('penalties', fn ($penalties): bool => $penalties->modelKeys() === [$open->id]);
    }

    public function test_paying_a_penalty_records_payment_and_ledger(): void
    {
        $admin = $this->signInAdmin();
        $penalty = $this->penaltyFor($admin, 10000);

        $this->post(route('penalties.pay', $penalty), ['penart_paid' => 20000])->assertSessionHas('error');

        $this->post(route('penalties.pay', $penalty), ['penart_paid' => 10000])->assertRedirect();

        $this->assertEquals(10000, $penalty->fresh()->paid_amount);
        $this->assertDatabaseHas('penalty_payments', ['penalty_id' => $penalty->id, 'amount' => 10000]);
        $this->assertEquals(10000, app(Ledger::class)->balance($admin->company_id, Account::Penalty, $admin->branch_id));

        $this->get(route('penalties.paid'))
            ->assertOk()
            ->assertSee('Paid Penarty List')
            ->assertSee($penalty->customer->full_name);
        $this->get(route('penalties.index'))->assertViewHas('penalties', fn ($penalties): bool => $penalties->isEmpty());
    }

    public function test_penalty_can_be_waived(): void
    {
        $admin = $this->signInAdmin();
        $penalty = $this->penaltyFor($admin, 10000);

        $this->post(route('penalties.waive', $penalty))->assertRedirect();

        $this->assertTrue($penalty->fresh()->is_waived);
    }

    public function test_penalties_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $loan = Loan::factory()->create();
        $foreign = Penalty::create([
            'company_id' => $loan->company_id,
            'branch_id' => $loan->branch_id,
            'customer_id' => $loan->customer_id,
            'loan_id' => $loan->id,
            'amount' => 1000,
            'penalty_date' => today(),
        ]);

        $this->post(route('penalties.waive', $foreign))->assertNotFound();
        $this->assertFalse($foreign->fresh()->is_waived);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function penaltyFor(Employee $admin, float $amount, array $attributes = []): Penalty
    {
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $loan = Loan::factory()->create(['customer_id' => $customer->id]);

        return Penalty::create($attributes + [
            'company_id' => $admin->company_id,
            'branch_id' => $admin->branch_id,
            'customer_id' => $customer->id,
            'loan_id' => $loan->id,
            'amount' => $amount,
            'penalty_date' => today(),
        ]);
    }
}
