<?php

namespace Tests\Feature\Settings;

use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CompanyTest extends TestCase
{
    use RefreshDatabase;

    public function test_company_profile_page_renders(): void
    {
        $admin = $this->signInAdmin();

        $this->get(route('settings.company'))
            ->assertOk()
            ->assertSee('Company Information')
            ->assertSee('Change Password')
            ->assertSee('Company Logo')
            ->assertSee($admin->company->name);
    }

    public function test_admin_can_update_company_profile(): void
    {
        $admin = $this->signInAdmin();
        $region = Region::create(['name' => 'Mwanza']);

        $this->put(route('settings.company.update'), [
            'comp_name' => 'TEST MFUMO MPYA',
            'comp_number' => '0711000000',
            'adress' => 'ilemela',
            'comp_phone' => '0711000000',
            'comp_email' => 'info@example.com',
            'region_id' => $region->id,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseHas('companies', ['id' => $admin->company_id, 'name' => 'TEST MFUMO MPYA', 'address' => 'ilemela', 'region_id' => $region->id]);
    }

    public function test_password_changes_only_with_correct_old_password(): void
    {
        $admin = $this->signInAdmin();

        $this->put(route('settings.password'), ['oldpass' => 'wrong', 'newpass' => 'secret99', 'passconf' => 'secret99'])
            ->assertSessionHas('error');
        $this->assertTrue(Hash::check('password', $admin->fresh()->password));

        $this->put(route('settings.password'), ['oldpass' => 'password', 'newpass' => 'secret99', 'passconf' => '999999'])
            ->assertSessionHasErrors('passconf');

        $this->put(route('settings.password'), ['oldpass' => 'password', 'newpass' => 'secret99', 'passconf' => 'secret99'])
            ->assertSessionHas('success');
        $this->assertTrue(Hash::check('secret99', $admin->fresh()->password));
    }

    public function test_admin_can_upload_company_logo(): void
    {
        Storage::fake('public');
        $admin = $this->signInAdmin();

        $this->post(route('settings.logo'), ['comp_logo' => UploadedFile::fake()->image('logo.png')])->assertRedirect();

        $logo = $admin->company->fresh()->logo;
        $this->assertStringStartsWith('logos/', $logo);
        Storage::disk('public')->assertExists($logo);
    }
}
