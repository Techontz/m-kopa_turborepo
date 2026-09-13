<?php

namespace Tests\Feature\Customers;

use App\Models\Customer;
use App\Models\CustomerType;
use App\Models\MainCategory;
use App\Models\Region;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_wizard_creates_a_complete_customer(): void
    {
        Storage::fake('public');
        $admin = $this->signInAdmin();
        $region = Region::create(['name' => 'Mwanza']);

        $this->get(route('customers.create'))->assertOk()->assertSee('Basic information')->assertSee('Passport size & Bank Detail');

        $response = $this->post(route('customers.store'), [
            'f_name' => 'Asha', 'm_name' => 'Juma', 'l_name' => 'Hamisi',
            'blanch_id' => $admin->branch_id, 'empl_id' => $admin->id, 'gender' => 'female',
            'date_birth' => '1995-04-10', 'phone_no' => '0754123456',
            'work_status' => 'ser', 'cust_type' => 'binafsi', 'region_id' => $region->id,
            'district' => 'Ilemela', 'ward' => 'Buswelu', 'street' => 'Mtaa A',
        ]);

        $customer = Customer::firstOrFail();
        $response->assertRedirect(route('customers.additional', $customer));
        $this->assertSame('255754123456', $customer->phone);
        $this->assertSame(Customer::STEP_ADDITIONAL, $customer->registration_step);
        $this->assertStringStartsWith('C', $customer->customer_code);

        $this->put(route('customers.additional.store', $customer), [
            'famous_area' => 'Mama Asha', 'martial_status' => 'Single', 'account_id' => 1,
            'bussiness_type' => 'Duka', 'place_imployment' => 'Soko Kuu', 'number_dependents' => 2,
            'month_income' => '350,000',
        ])->assertRedirect(route('customers.passport', $customer));
        $this->assertEquals(350000, $customer->fresh()->monthly_income);

        $this->post(route('customers.documents', $customer), [
            'natinal_identity' => '19950410000001',
            'signature' => UploadedFile::fake()->create('nida.pdf', 100, 'application/pdf'),
        ])->assertRedirect(route('loans.form', $customer));

        $customer->refresh();
        $this->assertSame(Customer::STEP_COMPLETE, $customer->registration_step);
        Storage::disk('public')->assertExists($customer->id_attachment);
    }

    public function test_identity_attachment_must_be_a_pdf(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->incomplete(Customer::STEP_PASSPORT)->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);

        $this->post(route('customers.documents', $customer), [
            'signature' => UploadedFile::fake()->image('id.jpg'),
        ])->assertSessionHasErrors(['signature' => 'PDF file is Allowed please change Your file']);
    }

    public function test_customer_type_lookup_depends_on_loan_type(): void
    {
        $admin = $this->signInAdmin();
        $main = MainCategory::create(['company_id' => $admin->company_id, 'code' => 'ser', 'name' => 'WAJASILIAMALI']);
        CustomerType::create(['main_category_id' => $main->id, 'code' => 'group', 'name' => 'VIKUNDI']);
        CustomerType::create(['main_category_id' => $main->id, 'code' => 'hazina', 'name' => 'HAZINA', 'is_enabled' => false]);

        $this->get(route('lookup.customer-types', ['work_status' => 'ser']))
            ->assertOk()
            ->assertSee('VIKUNDI')
            ->assertDontSee('HAZINA');

        $this->get(route('lookup.employees', ['branch_id' => $admin->branch_id]))->assertSee($admin->first_name);
    }

    public function test_loan_application_resumes_incomplete_registration(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->incomplete(Customer::STEP_PASSPORT)->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);

        $this->get(route('loans.start', $customer))->assertRedirect(route('customers.passport', $customer));
        $this->get(route('loans.form', $customer))->assertRedirect(route('customers.passport', $customer));
    }

    public function test_profile_page_renders_and_kyc_can_be_approved(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->incomplete()->create(['company_id' => $admin->company_id, 'branch_id' => $admin->branch_id]);

        $this->get(route('customers.show', $customer))->assertOk()->assertSee('KYC - Pending')->assertSee('Gualantors List');
        $this->post(route('customers.kyc', $customer))->assertRedirect();
        $this->assertSame('approved', $customer->fresh()->kyc_status);
    }

    public function test_other_company_customers_are_not_reachable(): void
    {
        $this->signInAdmin();
        $foreign = Customer::factory()->create();

        $this->get(route('customers.show', $foreign))->assertNotFound();
    }
}
