<?php

namespace Tests\Feature\Hrm;

use App\Enums\Account;
use App\Models\Employee;
use App\Models\SalaryPayment;
use App\Models\StaffAllowance;
use App\Models\StaffDeduction;
use App\Models\StaffLoan;
use App\Models\StaffLoanCategory;
use App\Models\StaffSalaryAdvance;
use App\Models\StaffSalaryAdvanceCategory;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StaffFinanceTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private Employee $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->staff = Employee::factory()->create(['company_id' => $this->admin->company_id, 'branch_id' => $this->admin->branch_id]);
    }

    public function test_hrm_pages_render(): void
    {
        $pages = [
            'leaves.index' => 'Employee Leave List',
            'allowances.index' => 'Sataff Allowance List',
            'deductions.index' => 'Sataff Deduction List',
            'salary-sheet.index' => 'Staff Sallary Sheet / '.now()->format('F, d, Y'),
            'staff-salary-advances.index' => 'Sallary Advance',
            'staff-loans.index' => 'Staff Loan',
            'staff-loans.active' => 'Staff Active Loan',
            'staff-loan-categories.index' => 'Staff Loan Category',
            'staff-salary-advance-categories.index' => 'Staff salary Advance Category',
        ];

        foreach ($pages as $route => $label) {
            $this->get(route($route))->assertOk()->assertSee($label);
        }
    }

    public function test_leave_allowance_and_deduction_can_be_created(): void
    {
        $this->post(route('leaves.store'), ['empl_id' => $this->staff->id, 'stat_date' => '2026-09-01', 'end_date' => '2026-09-10', 'remaks' => 'Annual'])->assertSessionHasNoErrors();
        $this->post(route('allowances.store'), ['blanch_id' => $this->staff->branch_id, 'empl_id' => $this->staff->id, 'new_amount' => 10000, 'remaks_allow' => 'Transport'])->assertSessionHasNoErrors();
        $this->post(route('deductions.store'), ['blanch_id' => $this->staff->branch_id, 'empl_id' => $this->staff->id, 'amount' => 30000, 'instalment' => 3, 'description' => 'Uniform'])->assertSessionHasNoErrors();

        $this->assertDatabaseHas('leaves', ['employee_id' => $this->staff->id, 'remarks' => 'Annual', 'status' => 'pending']);
        $this->assertDatabaseHas('staff_allowances', ['employee_id' => $this->staff->id, 'amount' => 10000, 'status' => 'active']);
        $this->assertDatabaseHas('staff_deductions', ['employee_id' => $this->staff->id, 'instalments' => 3, 'instalment_amount' => 10000]);

        $this->get(route('leaves.index'))->assertSee('Annual');
        $this->get(route('allowances.index'))->assertSee('Transport');
        $this->get(route('deductions.index', ['blanch_id' => 'all', 'from' => now()->toDateString(), 'to' => now()->toDateString()]))->assertSee('Uniform');
        $this->get(route('deductions.index', ['blanch_id' => 'all', 'from' => '2020-01-01', 'to' => '2020-01-02']))->assertDontSee('Uniform');
    }

    public function test_salary_advance_request_approve_and_reject(): void
    {
        $category = StaffSalaryAdvanceCategory::create(['company_id' => $this->admin->company_id, 'name' => 'SALARY ADVANCE STAFF', 'amount_from' => 10000, 'amount_to' => 100000, 'fee' => 200]);

        $this->post(route('staff-salary-advances.store'), ['blanch_id' => $this->staff->branch_id, 'empl_id' => $this->staff->id, 'fee' => $category->id, 'advance_amount' => 500])
            ->assertSessionHasErrors('advance_amount');

        $this->post(route('staff-salary-advances.store'), ['blanch_id' => $this->staff->branch_id, 'empl_id' => $this->staff->id, 'fee' => $category->id, 'advance_amount' => 20000])
            ->assertSessionHasNoErrors();
        $advance = StaffSalaryAdvance::firstOrFail();
        $this->assertSame('pending', $advance->status);

        $this->post(route('staff-salary-advances.approve', $advance))->assertSessionHas('success');
        $this->assertSame('approved', $advance->fresh()->status);
        $this->assertEqualsWithDelta(-20000, app(Ledger::class)->balance($this->admin->company_id, Account::Interest, $this->staff->branch_id), 0.01);

        $other = StaffSalaryAdvance::create(['company_id' => $this->admin->company_id, 'branch_id' => $this->staff->branch_id, 'employee_id' => $this->staff->id, 'staff_salary_advance_category_id' => $category->id, 'amount' => 15000]);
        $this->post(route('staff-salary-advances.reject', $other));
        $this->assertSame('rejected', $other->fresh()->status);
    }

    public function test_staff_loan_apply_approve_and_pay(): void
    {
        $category = $this->loanCategory();

        $this->post(route('staff-loans.store'), [
            'blanch_id' => $this->staff->branch_id,
            'empl_id' => $this->staff->id,
            'category_id' => $category->id,
            'loan_amount' => 10000,
            'day' => 'monthly',
            'session' => 2,
            'reason' => 'School fees',
        ])->assertSessionHasNoErrors();

        $loan = StaffLoan::firstOrFail();
        $this->assertSame('pending', $loan->status);

        $this->post(route('staff-loans.approve', $loan))->assertSessionHas('success');
        $loan->refresh();
        $this->assertSame('active', $loan->status);
        $this->assertEquals(12000, $loan->total_payable);
        $this->assertEquals(6000, $loan->restoration);
        $this->assertEquals(-10000, $this->sum(Account::Principal));

        $this->get(route('staff-loans.active'))->assertOk()->assertSee('12,000');

        $this->post(route('staff-loans.pay', $loan), ['amount' => 20000])->assertSessionHasErrors('amount');
        $this->post(route('staff-loans.pay', $loan), ['amount' => 6000])->assertSessionHas('success');

        $this->assertEquals(-5000, $this->sum(Account::Principal));
        $this->assertEquals(1000, $this->sum(Account::Interest));
        $this->assertEquals(6000, $loan->fresh()->remainingAmount());

        $this->post(route('staff-loans.pay', $loan), ['amount' => 6000]);
        $this->assertSame('done', $loan->fresh()->status);
        $this->assertEquals(0, $this->sum(Account::Principal));
    }

    public function test_salary_sheet_computes_take_home_and_pays(): void
    {
        $companyId = $this->admin->company_id;
        $branchId = $this->staff->branch_id;
        $this->staff->salaryInfo()->create(['salary' => 400000, 'account_name' => 'NMB', 'account_number' => '67676', 'fee' => 0]);
        StaffAllowance::create(['company_id' => $companyId, 'branch_id' => $branchId, 'employee_id' => $this->staff->id, 'amount' => 100000]);
        $deduction = StaffDeduction::create(['company_id' => $companyId, 'branch_id' => $branchId, 'employee_id' => $this->staff->id, 'amount' => 100000, 'instalments' => 2, 'instalment_amount' => 50000]);
        $advanceCategory = StaffSalaryAdvanceCategory::create(['company_id' => $companyId, 'name' => 'ADV', 'amount_from' => 0, 'amount_to' => 100000]);
        $advance = StaffSalaryAdvance::create(['company_id' => $companyId, 'branch_id' => $branchId, 'employee_id' => $this->staff->id, 'staff_salary_advance_category_id' => $advanceCategory->id, 'amount' => 20000, 'status' => 'approved']);
        $loan = StaffLoan::create([
            'company_id' => $companyId, 'branch_id' => $branchId, 'employee_id' => $this->staff->id, 'staff_loan_category_id' => $this->loanCategory()->id,
            'amount_applied' => 10000, 'amount_approved' => 10000, 'duration' => 'monthly', 'sessions' => 3, 'total_payable' => 12000, 'restoration' => 4000, 'reason' => 'x', 'status' => 'active',
        ]);

        // 400,000 + 100,000 − 20,000 − 50,000 − 4,000
        $this->get(route('salary-sheet.index'))->assertOk()->assertSee('426,000')->assertSee('67676');

        $this->post(route('salary-sheet.pay'), ['ac_id' => 'interest'])->assertSessionHas('success');

        $payment = SalaryPayment::where('employee_id', $this->staff->id)->firstOrFail();
        $this->assertEquals(426000, $payment->take_home);
        $this->assertSame('done', $advance->fresh()->status);
        $this->assertEquals(50000, $deduction->fresh()->paid_amount);
        $this->assertEquals(4000, $loan->payments()->sum('amount'));

        // Take-home leaves the Interest account; the withheld loan restoration is booked as salary expense against the staff loan receivable.
        $this->assertEqualsWithDelta(-426000, $this->sum(Account::Interest), 0.01);
        $this->assertEqualsWithDelta(426000 + round(4000 * 10000 / 12000, 2), $this->sum(Account::SalaryExpense), 0.01);

        // Staff without salary information are shown but not paid.
        $this->assertSame(0, SalaryPayment::where('employee_id', $this->admin->id)->count());
        $this->get(route('salary-sheet.index', ['from' => now()->toDateString(), 'to' => now()->toDateString()]))->assertSee('Sallary Paid');
    }

    public function test_staff_loan_and_salary_advance_categories_crud(): void
    {
        $this->post(route('staff-loan-categories.store'), [
            'category_name' => 'TEST1', 'from_amount' => 1000, 'to_amount' => 10000, 'interest' => 20,
            'duration' => 'monthly', 'from_repayment' => 1, 'to_repayment' => 3, 'fee' => 0,
        ])->assertSessionHasNoErrors();
        $loanCategory = StaffLoanCategory::firstOrFail();

        $this->put(route('staff-loan-categories.update', $loanCategory), [
            'category_name' => 'TEST2', 'from_amount' => 1000, 'to_amount' => 20000, 'interest' => 10,
            'duration' => 'weekly', 'from_repayment' => 1, 'to_repayment' => 4, 'fee' => 100,
        ])->assertSessionHasNoErrors();
        $this->assertSame('TEST2', $loanCategory->fresh()->name);
        $this->get(route('staff-loan-categories.index'))->assertSee('1,000 - 20,000');

        $this->delete(route('staff-loan-categories.destroy', $loanCategory));
        $this->assertModelMissing($loanCategory);

        $this->post(route('staff-salary-advance-categories.store'), ['cate_name' => 'SALARY ADVANCE STAFF', 'from_amount' => 10000, 'to_amount' => 100000, 'fee' => 200])->assertSessionHasNoErrors();
        $advanceCategory = StaffSalaryAdvanceCategory::firstOrFail();
        $this->put(route('staff-salary-advance-categories.update', $advanceCategory), ['cate_name' => 'NEW', 'from_amount' => 0, 'to_amount' => 50000, 'fee' => 0])->assertSessionHasNoErrors();
        $this->assertSame('NEW', $advanceCategory->fresh()->name);
        $this->delete(route('staff-salary-advance-categories.destroy', $advanceCategory));
        $this->assertModelMissing($advanceCategory);
    }

    public function test_other_company_records_are_not_reachable(): void
    {
        $foreignAdmin = Employee::factory()->admin()->create();
        $category = StaffLoanCategory::create(['company_id' => $foreignAdmin->company_id, 'name' => 'X', 'amount_from' => 1, 'amount_to' => 10, 'interest_rate' => 1, 'duration' => 'monthly', 'repayment_from' => 1, 'repayment_to' => 2]);

        $this->delete(route('staff-loan-categories.destroy', $category))->assertNotFound();
        $this->assertModelExists($category);

        $this->post(route('allowances.store'), ['blanch_id' => $foreignAdmin->branch_id, 'empl_id' => $foreignAdmin->id, 'new_amount' => 100])->assertSessionHasErrors(['blanch_id', 'empl_id']);
    }

    private function loanCategory(): StaffLoanCategory
    {
        return StaffLoanCategory::create(['company_id' => $this->admin->company_id, 'name' => 'TEST1', 'amount_from' => 1000, 'amount_to' => 10000, 'interest_rate' => 20, 'duration' => 'monthly', 'repayment_from' => 1, 'repayment_to' => 3, 'fee' => 0]);
    }

    private function sum(Account $account): float
    {
        return app(Ledger::class)->balance($this->admin->company_id, $account, allBranches: true);
    }
}
