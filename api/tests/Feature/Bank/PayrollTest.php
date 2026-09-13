<?php

namespace Tests\Feature\Bank;

use App\Models\SalaryPayment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollTest extends TestCase
{
    use RefreshDatabase;

    public function test_payroll_list_groups_payments_by_date_and_shows_details(): void
    {
        $admin = $this->signInAdmin();

        foreach ([84000, 8000] as $takeHome) {
            SalaryPayment::create([
                'company_id' => $admin->company_id, 'employee_id' => $admin->id, 'salary' => 100000,
                'take_home' => $takeHome, 'paid_from_account' => 'NMB', 'paid_on' => '2024-05-21',
                'phone' => '0711', 'account_name' => 'CRDB', 'account_number' => '898657465',
            ]);
        }

        $this->get(route('payroll.index'))
            ->assertOk()
            ->assertSee('Payrol List')
            ->assertSee('92,000')
            ->assertSee(route('payroll.show', '2024-05-21'));

        $this->get(route('payroll.show', '2024-05-21'))
            ->assertOk()
            ->assertSee('Payrol paid Date: 2024-05-21')
            ->assertSee('Loan Restration')
            ->assertSee($admin->full_name)
            ->assertSee('898657465');
    }

    public function test_invalid_date_is_not_found(): void
    {
        $this->signInAdmin();

        $this->get(route('payroll.show', 'not-a-date'))->assertNotFound();
    }
}
