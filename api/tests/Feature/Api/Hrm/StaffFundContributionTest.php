<?php

namespace Tests\Feature\Api\Hrm;

use App\Enums\Account;
use App\Models\Employee;
use App\Models\HrmSetting;
use App\Models\PayrollRun;
use App\Models\SalaryPayment;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Spec §26 + §55: the employee's 20 % is real money in the STAFF FUND A/C; the company's 20 % is an obligation recorded per
 * employee, never fund cash. Benefit record = 20,000 + 20,000 = 40,000 on a 100,000 basic salary.
 */
class StaffFundContributionTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(CarbonImmutable::parse('2026-07-25 09:00:00'));
        $this->admin = $this->signInAdmin();
    }

    private function employeeWithRole(string $role): Employee
    {
        return Employee::factory()->create([
            'company_id' => $this->admin->company_id,
            'branch_id' => $this->admin->branch_id,
            'role_id' => $this->admin->company->roles()->where('key', $role)->value('id'),
        ]);
    }

    private function balance(Account $account, ?int $employee = null): float
    {
        return app(Ledger::class)->balance($this->admin->company_id, $account, employee: $employee);
    }

    public function test_company_contribution_is_an_obligation_not_fund_cash(): void
    {
        $hr = $this->employeeWithRole('hr');
        $finance = $this->employeeWithRole('finance');

        // Default settings: staff 20 %, company 20 %.
        $this->actingAs($hr)->getJson('/api/v1/hrm/settings')->assertOk()
            ->assertJsonPath('data.staff_fund_percent', 20)
            ->assertJsonPath('data.company_fund_percent', 20);

        $staff = Employee::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id]);
        $staff->salaryInfo()->create(['salary' => 100000, 'salary_type' => 'branch', 'commission_eligible' => true, 'payment_method' => 'bank', 'account_name' => 'NMB', 'account_number' => '1', 'fee' => 0]);

        $this->actingAs($hr)->postJson('/api/v1/hrm/payroll/generate', ['period' => '2026-07'])->assertOk();
        $row = collect($this->actingAs($hr)->getJson('/api/v1/hrm/payroll?period=2026-07')->json('data.rows'))->firstWhere('employee_id', $staff->id);
        $this->assertEquals([100000, 20000, 20000, 80000], [$row['base_salary'], $row['staff_fund'], $row['company_fund'], $row['take_home']]);

        $run = PayrollRun::sole();
        $this->actingAs($this->admin)->postJson("/api/v1/hrm/payroll/{$run->id}/approve")->assertOk();
        // Approval records the company's 20,000 as owed to the employee; no fund money yet.
        $this->assertEquals(20000, $this->balance(Account::StaffFundObligation, $staff->id));
        $this->assertEquals(0, $this->balance(Account::StaffFundCash));

        $this->actingAs($finance)->postJson("/api/v1/hrm/payroll/{$run->id}/pay", ['ac_id' => 'interest'])->assertOk();

        // Actual fund cash received = the staff's 20,000 only.
        $this->assertEquals(20000, $this->balance(Account::StaffFundCash));
        $this->assertEquals(20000, $this->balance(Account::StaffFund, $staff->id));
        $this->assertEquals(20000, $this->balance(Account::StaffFundObligation, $staff->id));

        $fund = $this->actingAs($finance)->getJson('/api/v1/hrm/staff-fund')->assertOk()->json('data');
        $this->assertEquals(20000, $fund['balance']);
        $this->assertEquals(20000, $fund['company_contributions_owed']);
        $this->assertEquals(40000, $fund['total_benefit_record']);
        $member = collect($fund['members'])->firstWhere('employee_id', $staff->id);
        $this->assertEquals([20000, 20000, 40000], [$member['staff_contribution'], $member['company_contribution'], $member['total_benefit_record']]);

        $payment = SalaryPayment::sole();
        $this->actingAs($hr)->getJson("/api/v1/hrm/salary-payments/{$payment->id}")->assertOk()
            ->assertJsonPath('data.staff_fund', 20000)
            ->assertJsonPath('data.company_fund', 20000)
            ->assertJsonPath('data.benefit_record', 40000)
            ->assertJsonPath('data.take_home', 80000);

        $this->actingAs($hr)->getJson("/api/v1/hrm/staff/{$staff->id}")->assertOk()
            ->assertJsonPath('data.staff_fund_benefit.staff_contribution', 20000)
            ->assertJsonPath('data.staff_fund_benefit.company_contribution', 20000)
            ->assertJsonPath('data.staff_fund_benefit.total_benefit_record', 40000);
    }

    public function test_company_contribution_percent_is_configurable(): void
    {
        $hr = $this->employeeWithRole('hr');

        $this->actingAs($hr)->putJson('/api/v1/hrm/settings', ['company_fund_percent' => 101])->assertUnprocessable()->assertJsonValidationErrors('company_fund_percent');
        $this->actingAs($hr)->putJson('/api/v1/hrm/settings', ['company_fund_percent' => 15])->assertOk();

        $this->assertEquals(15, (float) HrmSetting::forCompany($this->admin->company_id)->company_fund_percent);
    }
}
