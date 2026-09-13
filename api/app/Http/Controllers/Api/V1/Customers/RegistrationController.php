<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Customers\AdditionalDetailsRequest;
use App\Models\Customer;
use App\Models\CustomerCategory;
use App\Models\Street;
use App\Services\Customers\CategoryFormValidator;
use App\Services\Customers\KycService;
use App\Services\Customers\NidaVerification;
use App\Services\Customers\TanzaniaLocations;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Register Customer (replaces the live Basic info → Aditinal Detail → Passport wizard) per Documents:
 * NIDA lookup + OTP → live face verification → additional data → customer category (dynamic form) → documents.
 */
class RegistrationController extends ApiController
{
    public function __construct(private NidaVerification $nida, private KycService $kyc) {}

    public function lookup(Request $request): JsonResponse
    {
        $this->authorizeAny('customers.register');
        $validated = $request->validate(['nida_number' => ['required', 'digits:20']], ['nida_number.digits' => 'NIDA number must be 20 digits']);

        $result = $this->nida->start($validated['nida_number'], $this->currentEmployee());

        return $this->message('OTP sent to the phone number registered at NIDA', 200, ['data' => $result]);
    }

    public function resendOtp(Request $request): JsonResponse
    {
        $this->authorizeAny('customers.register');
        $validated = $request->validate(['verification_id' => ['required', 'string']]);

        $this->nida->resend($validated['verification_id'], $this->currentEmployee());

        return $this->message('OTP sent again');
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $this->authorizeAny('customers.register');
        $validated = $request->validate(['verification_id' => ['required', 'string'], 'otp' => ['required', 'digits:6']]);

        $identity = $this->nida->verify($validated['verification_id'], $validated['otp'], $this->currentEmployee());

        return $this->message('OTP Verified successfully', 200, ['data' => $identity]);
    }

    /**
     * Creates the customer from verified NIDA data, assigned to a branch and loan officer (live fields blanch_id / empl_id).
     */
    public function register(Request $request): JsonResponse
    {
        $this->authorizeAny('customers.register');
        $companyId = $this->currentEmployee()->company_id;

        $validated = $request->validate([
            'verification_id' => ['required', 'string'],
            'blanch_id' => ['required', Rule::exists('branches', 'id')->where('company_id', $companyId)],
            'empl_id' => ['required', Rule::exists('employees', 'id')->where('company_id', $companyId)->where('branch_id', $request->integer('blanch_id'))],
        ], ['empl_id.exists' => 'The selected employee does not belong to the branch.']);
        $this->assertBranchAccessible((int) $validated['blanch_id']);

        $verification = $this->nida->consume($validated['verification_id'], $this->currentEmployee());
        $identity = $verification['identity'];

        $customer = DB::transaction(function () use ($identity, $verification, $validated, $companyId): Customer {
            $dateOfBirth = CarbonImmutable::parse($identity->dateOfBirth);

            $customer = Customer::create([
                'company_id' => $companyId,
                'branch_id' => (int) $validated['blanch_id'],
                'employee_id' => (int) $validated['empl_id'],
                'first_name' => $identity->firstName,
                'middle_name' => $identity->middleName,
                'last_name' => $identity->lastName,
                'gender' => $identity->gender,
                'date_of_birth' => $dateOfBirth->toDateString(),
                'age' => now()->year - $dateOfBirth->year,
                'phone' => $identity->phone,
                'id_number' => $identity->nidaNumber,
                'work_status' => 'ser',
                'district' => '',
                'ward' => '',
                'street' => '',
                'account_type' => 'LOAN ACCOUNT',
                'status' => 'pending',
                'kyc_status' => 'pending',
                'registration_step' => Customer::STEP_BASIC,
            ]);

            $customer->kyc()->create([
                'nida_number' => $identity->nidaNumber,
                'nida_data' => $identity->toArray(),
                'nida_verified_at' => now(),
                'otp_phone' => $verification['otp_phone'],
                'otp_verified_at' => CarbonImmutable::parse($verification['otp_verified_at']),
            ]);

            return $customer;
        });

        $this->kyc->audit($customer, 'Customer.nida_verified', ['nida_number' => $identity->nidaNumber]);

        return $this->message('Customer Registered successfully', 201, ['data' => ['id' => $customer->id, 'customer_code' => $customer->fresh()->customer_code]]);
    }

    public function face(Request $request, Customer $customer): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertCustomerAccessible($customer);

        $validated = $request->validate([
            'frames' => ['required', 'array', 'min:3', 'max:10'],
            'frames.*' => ['required', 'string', 'starts_with:data:image/', 'max:3000000'],
        ], ['frames.min' => 'Live capture needs at least 3 camera frames.']);

        $this->kyc->verifyFace($customer->load('kyc'), $validated['frames']);
        $this->kyc->sync($customer);

        return $this->message('Face Verified successfully');
    }

    public function additional(AdditionalDetailsRequest $request, Customer $customer, TanzaniaLocations $locations): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $this->assertCustomerAccessible($customer);

        DB::transaction(function () use ($request, $customer, $locations): void {
            $regionName = (string) $locations->regionName($request->string('region_code')->toString());
            $districtName = (string) $locations->districtName($request->string('region_code')->toString(), $request->string('district_code')->toString());
            $wardName = (string) $locations->wardName($request->string('district_code')->toString(), $request->string('ward_code')->toString());
            $street = mb_convert_case($request->string('street_name')->trim()->squish()->toString(), MB_CASE_TITLE);

            Street::firstOrCreate(['ward_code' => $request->string('ward_code')->toString(), 'name' => $street]);

            $customer->residence()->updateOrCreate([], [
                'region_code' => $request->string('region_code')->toString(),
                'region_name' => $regionName,
                'district_code' => $request->string('district_code')->toString(),
                'district_name' => $districtName,
                'ward_code' => $request->string('ward_code')->toString(),
                'ward_name' => $wardName,
                'street_name' => $street,
                'ownership' => $request->string('residence_type')->toString(),
            ]);

            $customer->bankDetail()->updateOrCreate([], [
                'bank_name' => $request->string('bank_name')->trim()->toString(),
                'account_number' => $request->string('account_number')->trim()->toString(),
                'account_name' => $request->string('account_name')->trim()->toString(),
                'check_number' => $request->filled('check_number') ? $request->string('check_number')->trim()->toString() : null,
                'phone' => AdditionalDetailsRequest::normalisePhone($request->input('bank_phone')),
            ]);

            $customer->nextOfKin()->updateOrCreate([], [
                'first_name' => $request->string('kin_first_name')->trim()->toString(),
                'middle_name' => $request->filled('kin_middle_name') ? $request->string('kin_middle_name')->trim()->toString() : null,
                'last_name' => $request->string('kin_last_name')->trim()->toString(),
                'phone' => (string) AdditionalDetailsRequest::normalisePhone($request->string('kin_phone')->toString()),
                'relationship' => $request->filled('kin_relationship') ? $request->string('kin_relationship')->trim()->toString() : null,
            ]);

            $customer->update(array_filter([
                'marital_status' => $request->string('martial_status')->toString(),
                'region_id' => $locations->matchLegacyRegionId($regionName) ?? $customer->region_id,
                'district' => $districtName,
                'ward' => $wardName,
                'street' => $street,
                'account_number' => $request->string('account_number')->trim()->toString(),
                'bank_account_name' => $request->string('bank_name')->trim()->toString(),
                'check_number' => $request->filled('check_number') ? $request->string('check_number')->trim()->toString() : $customer->check_number,
                'nickname' => $request->filled('famous_area') ? $request->string('famous_area')->trim()->toString() : null,
                'business_type' => $request->filled('bussiness_type') ? $request->string('bussiness_type')->trim()->toString() : null,
                'place_of_business' => $request->filled('place_imployment') ? $request->string('place_imployment')->trim()->toString() : null,
                'dependents' => $request->filled('number_dependents') ? $request->integer('number_dependents') : null,
                'monthly_income' => $request->filled('month_income') ? (float) $request->input('month_income') : null,
                'registration_step' => max($customer->registration_step, Customer::STEP_PASSPORT),
            ], fn (mixed $value): bool => $value !== null));
        });

        $this->kyc->sync($customer);

        return $this->message('Customer information updated successfully');
    }

    /**
     * Customer Category Assignment (Loan Officer, Branch Manager) with the category's dynamic form answers.
     */
    public function category(Request $request, Customer $customer, CategoryFormValidator $forms): JsonResponse
    {
        $this->authorizeAny('customers.categorize');
        $this->assertCustomerAccessible($customer);

        $validated = $request->validate([
            'customer_category_id' => ['required', Rule::exists('customer_categories', 'id')->where('company_id', $customer->company_id)->where('is_active', true)],
            'answers' => ['present', 'array'],
        ]);

        if ($customer->kyc()->doesntExist()) {
            return $this->message('Verify the customer NIDA and OTP first', 422, ['errors' => ['customer_category_id' => ['Verify the customer NIDA and OTP first']]]);
        }

        $category = CustomerCategory::findOrFail($validated['customer_category_id']);
        $answers = $forms->validate($category, $validated['answers']);
        $before = ['customer_category_id' => $customer->customer_category_id];

        DB::transaction(function () use ($customer, $category, $answers): void {
            $customer->update([
                'customer_category_id' => $category->id,
                'customer_type' => $category->key,
                'work_status' => in_array($category->key, ['mjasiriamali', 'mwanafunzi'], true) ? 'ser' : 'ent',
                'check_number' => $answers['check_number'] ?? $answers['mstaafu_check'] ?? $customer->check_number,
                'monthly_income' => $answers['mshahara'] ?? $answers['mapato'] ?? $answers['pensheni'] ?? $customer->monthly_income,
                'business_type' => $answers['aina'] ?? $answers['cheo'] ?? $answers['sb_cheo'] ?? $answers['mstaafu_cheo'] ?? $answers['kozi'] ?? $customer->business_type,
            ]);

            $customer->kyc()->firstOrFail()->update([
                'category_answers' => $answers,
                'category_assigned_at' => now(),
                'category_assigned_by' => $this->currentEmployee()->id,
            ]);
        });

        $this->kyc->audit($customer, 'Customer.category_assigned', ['customer_category_id' => $category->id], $before);
        $this->kyc->sync($customer);

        return $this->message('Customer category assigned successfully');
    }

    private function assertCustomerAccessible(Customer $customer): void
    {
        abort_unless($this->scoped(Customer::query())->whereKey($customer->id)->exists(), 404);
    }
}
