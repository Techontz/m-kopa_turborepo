<?php

namespace Tests\Feature\Api\Customers;

use App\Integrations\Sms\LogSmsGateway;
use App\Integrations\Sms\SmsGateway;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\LoanCategory;
use App\Models\Street;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CustomerRegistrationApiTest extends TestCase
{
    use RefreshDatabase;

    private const NIDA = '19900415123450000113';

    public function test_full_nida_otp_face_details_category_documents_flow_completes_kyc(): void
    {
        Storage::fake('local');
        $admin = $this->signInAdmin();
        $category = $this->category($admin);
        $product = LoanCategory::factory()->create(['company_id' => $admin->company_id]);
        $category->loanCategories()->attach($product);

        $lookup = $this->postJson('/api/v1/customers/nida/lookup', ['nida_number' => self::NIDA])
            ->assertOk()
            ->assertJsonPath('data.identity.date_of_birth', '1990-04-15')
            ->assertJsonPath('data.identity.gender', 'male');
        $verificationId = $lookup->json('data.verification_id');
        $nidaPhone = $lookup->json('data.identity.phone');

        /** @var LogSmsGateway $sms */
        $sms = app(SmsGateway::class);
        $this->assertSame($nidaPhone, $sms->sent[0]['phone']);
        $this->assertStringContainsString('123456', $sms->sent[0]['message']);

        $this->postJson('/api/v1/customers/register', ['verification_id' => $verificationId, 'blanch_id' => $admin->branch_id, 'empl_id' => $admin->id])
            ->assertUnprocessable()->assertJsonValidationErrors('otp');
        $this->postJson('/api/v1/customers/nida/verify', ['verification_id' => $verificationId, 'otp' => '654321'])
            ->assertUnprocessable()->assertJsonValidationErrors('otp');
        $this->postJson('/api/v1/customers/nida/verify', ['verification_id' => $verificationId, 'otp' => '123456'])->assertOk();

        $customerId = $this->postJson('/api/v1/customers/register', ['verification_id' => $verificationId, 'blanch_id' => $admin->branch_id, 'empl_id' => $admin->id])
            ->assertCreated()
            ->json('data.id');

        $customer = Customer::findOrFail($customerId);
        $this->assertSame(self::NIDA, $customer->id_number);
        $this->assertSame($nidaPhone, $customer->phone);
        $this->assertSame('pending', $customer->kyc_status);
        $this->assertNotNull($customer->kyc->otp_verified_at);

        $this->postJson("/api/v1/customers/{$customerId}/face", ['frames' => array_fill(0, 3, $this->frame(10))])
            ->assertUnprocessable()->assertJsonValidationErrors('frames');
        $this->postJson("/api/v1/customers/{$customerId}/face", ['frames' => [$this->frame(10), $this->frame(80), $this->frame(160)]])->assertOk();
        $this->getJson("/api/v1/customers/{$customerId}/photo")->assertOk();

        $this->putJson("/api/v1/customers/{$customerId}/additional", $this->details(['ward_code' => 'TZ0102011']))
            ->assertUnprocessable()->assertJsonValidationErrors('ward_code');
        $this->putJson("/api/v1/customers/{$customerId}/additional", $this->details())->assertOk();

        $customer->refresh();
        $this->assertSame('Married', $customer->marital_status);
        $this->assertSame('Bumbuta', $customer->ward);
        $this->assertSame('Dodoma', $customer->residence->region_name);
        $this->assertSame('255754000111', $customer->nextOfKin->phone);
        $this->assertTrue(Street::where('ward_code', 'TZ0101011')->where('name', 'Mtaa Wa Soko')->exists());

        $this->putJson("/api/v1/customers/{$customerId}/category", ['customer_category_id' => $category->id, 'answers' => ['sekta' => 'Kilimo', 'aina' => 'Mama Ntilie']])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['answers.aina', 'answers.tin', 'answers.mapato']);
        $this->putJson("/api/v1/customers/{$customerId}/category", ['customer_category_id' => $category->id, 'answers' => $this->answers()])->assertOk();

        $this->getJson("/api/v1/customers/{$customerId}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.kyc_complete', false)
            ->assertJsonPath('data.eligible', false);

        $this->postJson("/api/v1/customers/{$customerId}/documents", ['document_type' => 'NIDA', 'file' => UploadedFile::fake()->create('nida.pdf', 50, 'application/pdf')])->assertCreated();
        $this->postJson("/api/v1/customers/{$customerId}/documents", ['document_type' => 'Unknown', 'file' => UploadedFile::fake()->create('x.pdf', 50, 'application/pdf')])
            ->assertUnprocessable()->assertJsonValidationErrors('document_type');
        $this->postJson("/api/v1/customers/{$customerId}/documents", ['document_type' => 'Business licence', 'file' => UploadedFile::fake()->image('licence.jpg')])->assertCreated();

        $customer->refresh();
        $this->assertSame('approved', $customer->kyc_status);
        $this->assertSame(Customer::STEP_COMPLETE, $customer->registration_step);
        $this->assertSame('mjasiriamali', $customer->customer_type);
        $this->assertTrue(AuditLog::where('action', 'Customer.kyc_completed')->where('auditable_id', $customerId)->exists());

        $this->getJson("/api/v1/customers/{$customerId}/eligibility")
            ->assertOk()
            ->assertJsonPath('data.kyc_complete', true)
            ->assertJsonPath('data.eligible', true)
            ->assertJsonPath('data.risk_level', 'high')
            ->assertJsonPath('data.max_amount', 2000000)
            ->assertJsonPath('data.loan_category_ids', [$product->id]);

        $this->getJson("/api/v1/customers/{$customerId}")
            ->assertOk()
            ->assertJsonPath('data.kyc.state', 'completed')
            ->assertJsonPath('data.category.key', 'mjasiriamali')
            ->assertJsonCount(2, 'data.documents');

        $documentId = $customer->documents()->first()->id;
        $this->deleteJson("/api/v1/customers/{$customerId}/documents/{$documentId}")->assertOk();
        $this->assertSame('pending', $customer->fresh()->kyc_status);
    }

    public function test_unknown_or_already_registered_nida_numbers_are_rejected(): void
    {
        $admin = $this->signInAdmin();

        $this->postJson('/api/v1/customers/nida/lookup', ['nida_number' => '00001234567890123456'])
            ->assertUnprocessable()->assertJsonValidationErrors(['nida_number' => 'NIDA number not found']);
        $this->postJson('/api/v1/customers/nida/lookup', ['nida_number' => '123'])->assertUnprocessable()->assertJsonValidationErrors('nida_number');

        Customer::factory()->create(['branch_id' => $admin->branch_id, 'id_number' => self::NIDA]);
        $this->postJson('/api/v1/customers/nida/lookup', ['nida_number' => self::NIDA])
            ->assertUnprocessable()->assertJsonValidationErrors(['nida_number' => 'Customer with this NIDA number is already registered']);
    }

    public function test_nida_data_is_not_editable_after_verification(): void
    {
        $admin = $this->signInAdmin();
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id, 'first_name' => 'JUMA']);
        $customer->kyc()->create(['nida_number' => self::NIDA, 'nida_data' => [], 'nida_verified_at' => now(), 'otp_verified_at' => now()]);

        $this->putJson("/api/v1/customers/{$customer->id}", ['blanch_id' => $admin->branch_id, 'empl_id' => $admin->id, 'f_name' => 'CHANGED', 'phone_no' => '0700000001'])->assertOk();

        $customer->refresh();
        $this->assertSame('JUMA', $customer->first_name);
        $this->assertSame($admin->id, $customer->employee_id);
    }

    public function test_roles_without_registration_or_categorize_permission_are_forbidden(): void
    {
        $admin = $this->signInAdmin();
        $category = $this->category($admin);
        $customer = Customer::factory()->create(['branch_id' => $admin->branch_id]);
        $customer->kyc()->create(['nida_number' => self::NIDA, 'nida_data' => [], 'nida_verified_at' => now(), 'otp_verified_at' => now()]);

        $this->actingAs($this->employeeWithRole($admin, 'zone_manager'));
        $this->postJson('/api/v1/customers/nida/lookup', ['nida_number' => self::NIDA])->assertForbidden();

        $this->actingAs($this->employeeWithRole($admin, 'teller'));
        $this->putJson("/api/v1/customers/{$customer->id}/category", ['customer_category_id' => $category->id, 'answers' => $this->answers()])->assertForbidden();
    }

    public function test_location_and_category_lookups(): void
    {
        $admin = $this->signInAdmin();
        $this->category($admin);
        Street::create(['ward_code' => 'TZ0101011', 'name' => 'Mtaa A']);

        $this->getJson('/api/v1/customers/locations/regions')->assertOk()->assertJsonFragment(['value' => 'TZ07', 'label' => 'Dar-es-salaam']);
        $this->getJson('/api/v1/customers/locations/districts?region=TZ01')->assertOk()->assertJsonFragment(['value' => 'TZ0101', 'label' => 'Kondoa']);
        $this->getJson('/api/v1/customers/locations/wards?district=TZ0101')->assertOk()->assertJsonFragment(['value' => 'TZ0101011', 'label' => 'Bumbuta']);
        $this->getJson('/api/v1/customers/locations/streets?ward=TZ0101011')->assertOk()->assertJsonPath('data.0.label', 'Mtaa A');
        $this->getJson('/api/v1/customers/categories')->assertOk()->assertJsonPath('data.0.key', 'mjasiriamali');
        $this->getJson('/api/v1/customers/categories/option-trees')->assertOk()->assertJsonStructure(['data' => ['TAASISI', 'SEKTA', 'SEKTA_BINAFSI', 'VYUO', 'BANKS', 'MFUKO_HIFADHI']]);
    }

    private function category(Employee $admin): CustomerCategory
    {
        $types = json_decode((string) file_get_contents(database_path('data/customer-types.json')), true)['types'];
        $type = collect($types)->firstWhere('key', 'mjasiriamali');

        return CustomerCategory::create([
            'company_id' => $admin->company_id,
            'key' => 'mjasiriamali',
            'name' => $type['label'],
            'risk_level' => 'high',
            'min_loan_amount' => 20000,
            'max_loan_amount' => 2000000,
            'required_documents' => ['NIDA', 'Business licence'],
            'form_schema' => $type['fields'],
        ]);
    }

    /**
     * @return array<string, string|int>
     */
    private function answers(): array
    {
        return ['tin' => '123-456-789', 'sekta' => 'Kilimo', 'aina' => 'Mkulima wa mahindi', 'jina_biashara' => 'Shamba Bora', 'mapato' => 450000, 'mahali_biashara' => 'Kondoa'];
    }

    /**
     * @param  array<string, string>  $overrides
     * @return array<string, string>
     */
    private function details(array $overrides = []): array
    {
        return array_merge([
            'martial_status' => 'Married',
            'region_code' => 'TZ01',
            'district_code' => 'TZ0101',
            'ward_code' => 'TZ0101011',
            'street_name' => 'mtaa wa soko',
            'residence_type' => 'rented',
            'bank_name' => 'CRDB Bank',
            'account_number' => '0152000111',
            'account_name' => 'JUMA ALLY MUSHI',
            'check_number' => '',
            'bank_phone' => '0754000222',
            'kin_first_name' => 'Asha',
            'kin_last_name' => 'Mushi',
            'kin_phone' => '0754000111',
            'kin_relationship' => 'Mke',
        ], $overrides);
    }

    private function frame(int $shade): string
    {
        $image = imagecreatetruecolor(8, 8);
        imagefill($image, 0, 0, imagecolorallocate($image, $shade, $shade, $shade));
        ob_start();
        imagejpeg($image);

        return 'data:image/jpeg;base64,'.base64_encode((string) ob_get_clean());
    }

    private function employeeWithRole(Employee $admin, string $role): Employee
    {
        return Employee::factory()->create([
            'company_id' => $admin->company_id,
            'branch_id' => $admin->branch_id,
            'role_id' => $admin->company->roles()->where('key', $role)->value('id'),
        ]);
    }
}
