<?php

namespace Tests\Feature\Hrm;

use App\Models\Branch;
use App\Models\Employee;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EmployeeTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_pages_render(): void
    {
        $admin = $this->signInAdmin();
        $staff = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);
        $rejected = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'status' => 'rejected']);

        $this->get(route('employees.index'))->assertOk()->assertSee('Employee List')->assertSee('Register Employee')->assertSee($staff->phone)->assertDontSee($rejected->phone);
        $this->get(route('employees.rejected'))->assertOk()->assertSee('Rejected Employee')->assertSee($rejected->phone);
        $this->get(route('employees.by-branch'))->assertOk()->assertSee('Branch List')->assertSee($admin->branch->name);
        $this->get(route('employees.show', $staff))->assertOk()->assertSee('Upload Pasport')->assertSee('Basic Information')->assertSee('Salary Slip');
        $this->get(route('employees.privileges', $staff))->assertOk()->assertSee('Privillage List')->assertSee('Privillage For ('.$staff->first_name.')');
    }

    public function test_admin_can_register_an_employee_with_phone_as_default_password(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('employees.store'), [
            'empl_name' => 'Jj',
            'emp_mname' => 'Uu',
            'emp_lname' => 'Yy',
            'empl_no' => '0778296279',
            'date_birth' => '1995-01-01',
            'year' => '31',
            'empl_email' => 'jj@example.com',
            'blanch_id' => $admin->branch_id,
            'position_id' => 'employee',
            'username' => 'Ufff',
            'empl_sex' => 'Male',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $employee = Employee::where('phone', '0778296279')->firstOrFail();
        $this->assertSame($admin->company_id, $employee->company_id);
        $this->assertSame('active', $employee->status);
        $this->assertMatchesRegularExpression('/^MK-\d{3}\d{4}$/', $employee->employee_number);
        $this->assertTrue(Hash::check('0778296279', $employee->password));
    }

    public function test_employee_can_be_updated_and_salary_info_saved(): void
    {
        $admin = $this->signInAdmin();
        $staff = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);

        $this->put(route('employees.update', $staff), [
            'empl_name' => 'tes',
            'emp_mname' => 'mfumo',
            'emp_lname' => 'mpya',
            'empl_no' => '0711',
            'date_birth' => '1990-05-05',
            'empl_email' => 'tes@example.com',
            'blanch_id' => $admin->branch_id,
            'position_id' => 'hq',
            'username' => 'TEST',
            'empl_sex' => 'Female',
        ])->assertSessionHasNoErrors();

        $this->post(route('employees.salary', $staff), [
            'salary' => '100000',
            'account_name' => 'CRDB',
            'account_number' => '898657465',
            'fee_salary' => '0',
        ])->assertSessionHasNoErrors();

        $staff->refresh();
        $this->assertSame('mpya', $staff->last_name);
        $this->assertSame('hq', $staff->position);
        $this->assertSame('female', $staff->gender);
        $this->assertEquals(100000, $staff->salaryInfo->salary);

        $this->get(route('employees.show', $staff))->assertSee('898657465');
    }

    public function test_block_reject_reset_password_and_delete(): void
    {
        $admin = $this->signInAdmin();
        $staff = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'phone' => '0799']);

        $this->post(route('employees.block', $staff))->assertRedirect();
        $this->assertSame('blocked', $staff->fresh()->status);
        $this->post(route('employees.block', $staff));
        $this->assertSame('active', $staff->fresh()->status);

        $this->post(route('employees.reset', $staff));
        $this->assertTrue(Hash::check('0799', $staff->fresh()->password));

        $this->post(route('employees.reject', $staff));
        $this->assertSame('rejected', $staff->fresh()->status);

        $this->delete(route('employees.destroy', $staff))->assertRedirect();
        $this->assertModelMissing($staff);
    }

    public function test_admin_cannot_block_or_delete_own_account(): void
    {
        $admin = $this->signInAdmin();

        $this->post(route('employees.block', $admin))->assertSessionHas('error');
        $this->delete(route('employees.destroy', $admin))->assertSessionHas('error');

        $this->assertSame('active', $admin->fresh()->status);
    }

    public function test_password_change_requires_the_old_password(): void
    {
        $admin = $this->signInAdmin();
        $staff = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id, 'password' => 'secret1']);

        $this->put(route('employees.password', $staff), ['oldpass' => 'wrong', 'newpass' => 'newpass', 'passconf' => 'newpass'])->assertSessionHas('error');
        $this->put(route('employees.password', $staff), ['oldpass' => 'secret1', 'newpass' => 'newpass', 'passconf' => 'newpass'])->assertSessionHas('success');

        $this->assertTrue(Hash::check('newpass', $staff->fresh()->password));
    }

    public function test_passport_photo_upload(): void
    {
        Storage::fake('public');
        $admin = $this->signInAdmin();

        $this->post(route('employees.photo', $admin), ['image' => UploadedFile::fake()->image('pass.png')])->assertRedirect();

        $this->assertNotNull($admin->fresh()->photo);
        Storage::disk('public')->assertExists($admin->fresh()->photo);
    }

    public function test_privileges_can_be_added_and_removed(): void
    {
        $admin = $this->signInAdmin();
        $staff = Employee::factory()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);

        $this->post(route('employees.privileges.add', $staff), ['privilege' => 'customer'])->assertRedirect();
        $this->post(route('employees.privileges.add', $staff), ['privilege' => 'customer']);
        $this->assertSame(1, $staff->privileges()->count());

        $privilege = $staff->privileges()->first();
        $this->delete(route('employees.privileges.remove', [$staff, $privilege]))->assertRedirect();
        $this->assertSame(0, $staff->privileges()->count());
    }

    public function test_employees_of_other_companies_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = Employee::factory()->create(['branch_id' => Branch::factory()]);

        $this->get(route('employees.show', $foreign))->assertNotFound();
        $this->delete(route('employees.destroy', $foreign))->assertNotFound();
        $this->assertModelExists($foreign);
    }
}
