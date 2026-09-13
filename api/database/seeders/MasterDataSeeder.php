<?php

namespace Database\Seeders;

use App\Enums\Duration;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Company;
use App\Models\CustomerCategory;
use App\Models\Employee;
use App\Models\ExpenseType;
use App\Models\Group;
use App\Models\InterestFormula;
use App\Models\LoanCategory;
use App\Models\MainCategory;
use App\Models\PaymentMode;
use App\Models\Region;
use App\Models\SalaryAdvanceCategory;
use App\Models\StaffLoanCategory;
use App\Models\StaffSalaryAdvanceCategory;
use App\Models\Zone;
use App\Services\AccessControl;
use Illuminate\Database\Seeder;

/**
 * Configuration observed on the live system (regions, products, categories, settings).
 * Contains no customer or staff personal data.
 */
class MasterDataSeeder extends Seeder
{
    /**
     * @var list<string>
     */
    private const REGIONS = ['Mbeya', 'Mwanza', 'Chato', 'Geita', 'Dar es salaam', 'Ruvuma', 'Unguja South', 'Unguja North', 'Tanga', 'Tabora', 'Songwe', 'Singida', 'Simiyu', 'Shinyanga', 'Rukwa', 'Pwani', 'Pemba South', 'Pemba North', 'Njombe', 'Mtwara', 'Morogoro', 'Mjini Magharibi', 'Mara', 'Manyara', 'Lindi', 'Kilimanjaro', 'Kigoma', 'Katavi', 'Kagera', 'Iringa', 'Dodoma', 'Arusha'];

    public function run(): void
    {
        foreach (self::REGIONS as $index => $name) {
            Region::updateOrCreate(['id' => $index + 1], ['name' => $name]);
        }

        $company = Company::updateOrCreate(['phone' => config('demo.admin_phone')], [
            'name' => 'TEST MFUMO MPYA',
            'registration_number' => '0001',
            'address' => 'ilemela',
            'email' => config('demo.admin_email'),
            'region_id' => $this->region('Mwanza'),
            'loan_fee_mode' => 'product',
            'penalty_type' => 'percentage',
            'penalty_value' => 20,
            'reserve_percent' => 20,
        ]);

        app(AccessControl::class)->seedRoles($company);
        $lakeZone = Zone::firstOrCreate(['company_id' => $company->id, 'name' => 'KANDA YA ZIWA']);
        $southZone = Zone::firstOrCreate(['company_id' => $company->id, 'name' => 'KANDA YA KUSINI']);
        $zoneFor = ['Head office' => $lakeZone, 'Kakonko' => $lakeZone, 'Missenyi' => $lakeZone, 'Lindi' => $southZone, 'NEW KALENGE' => $southZone, 'TEST' => $southZone];

        $branches = collect([
            ['Head office', '0666', 'Mwanza', 'main'],
            ['Kakonko', '0555', 'Kigoma', 'main'],
            ['Missenyi', '0444', 'Kagera', 'main'],
            ['Lindi', '0333', 'Lindi', 'main'],
            ['NEW KALENGE', '0666', 'Mbeya', 'sub'],
            ['TEST', '09989789879', 'Mbeya', 'sub'],
        ])->map(fn (array $row): Branch => Branch::updateOrCreate(
            ['company_id' => $company->id, 'name' => $row[0]],
            ['phone' => $row[1], 'region_id' => $this->region($row[2]), 'type' => $row[3], 'status' => 'active', 'zone_id' => $zoneFor[$row[0]]->id],
        ));

        $admin = Employee::updateOrCreate(['phone' => config('demo.admin_phone')], [
            'company_id' => $company->id,
            'branch_id' => $branches->first()->id,
            'employee_number' => 'MK-0012024',
            'first_name' => 'ADMIN',
            'last_name' => 'MIKOPOFASTA',
            'email' => config('demo.admin_email'),
            'username' => 'admin',
            'gender' => 'male',
            'position' => 'admin',
            'role_id' => $company->roles()->where('key', 'super_admin')->value('id'),
            'status' => 'active',
            'password' => config('demo.admin_password'),
        ]);
        foreach (array_keys(Employee::PRIVILEGES) as $privilege) {
            $admin->privileges()->firstOrCreate(['privilege' => $privilege]);
        }

        foreach ([['SIMPLE', 'SIMPLE FORMULAR', true], ['FLATRATE', 'FLAT RATE FORMULAR', true], ['REDUCING', 'REDUCING FORMULAR', false]] as [$code, $name, $enabled]) {
            InterestFormula::updateOrCreate(['code' => $code], ['name' => $name, 'is_enabled' => $enabled]);
        }

        $watumishi = MainCategory::updateOrCreate(['company_id' => $company->id, 'code' => 'ent'], ['name' => 'WATUMISHI']);
        $wajasiliamali = MainCategory::updateOrCreate(['company_id' => $company->id, 'code' => 'ser'], ['name' => 'WAJASILIAMALI']);

        foreach ([['hazina', 'HAZINA', false], ['binafsi', 'BINAFSI', true], ['WASTAFU', 'WASTAFU', true], ['VIP', 'VIP', true]] as [$code, $name, $enabled]) {
            $watumishi->customerTypes()->updateOrCreate(['code' => $code], ['name' => $name, 'is_enabled' => $enabled]);
        }
        foreach ([['group', 'VIKUNDI'], ['binafsi', 'BINAFSI'], ['VIP', 'VIP']] as [$code, $name]) {
            $wajasiliamali->customerTypes()->updateOrCreate(['code' => $code], ['name' => $name, 'is_enabled' => true]);
        }

        $products = [
            // name, main, from, to, rate, duration, rep from, rep to, fee deduct, approve, topup, take home, fee, insurance
            ['WAJASILIAMALI', $wajasiliamali, 20000, 2000000, 30, Duration::Weekly, 1, 3, true, 'hq', 50, 70, 5000, 5000],
            ['GROUP LOAN', $wajasiliamali, 600000, 1000000, 20, Duration::Weekly, 1, 5, true, 'hq', 90, 90, 75000, 100000],
            ['VIKUNDI 1', $wajasiliamali, 250000, 500000, 30, Duration::Weekly, 1, 3, true, 'branch', 50, 70, 5000, 25000],
            ['VIKUNDI 2', $wajasiliamali, 500000, 1000000, 30, Duration::Weekly, 1, 8, true, 'hq', 50, 70, 10000, 50000],
            ['WATUMISHI 2', $watumishi, 500000, 1200000, 30, Duration::Monthly, 1, 6, true, 'branch', 50, 70, 10000, 10000],
            ['WATUMISHI 3', $watumishi, 1000000, 3000000, 40, Duration::Monthly, 1, 8, true, 'hq', 50, 70, 10000, 30000],
            ['NEW WATUMISHI 1', $watumishi, 100000, 500000, 20, Duration::Monthly, 1, 4, true, 'branch', 50, 70, 5000, 5000],
            ['NEW WATUMISHI 2', $watumishi, 500000, 1500000, 20, Duration::Monthly, 1, 6, true, 'zone manager', 50, 70, 10000, 10000],
            ['NEW WATUMISHI 3', $watumishi, 1000000, 5000000, 50, Duration::Monthly, 1, 12, true, 'hq', 50, 70, 10000, 20000],
            ['VIP DESK', $watumishi, 1000000, 5000000, 30, Duration::Monthly, 1, 2, false, 'hq', 100, 100, 0, 0],
            ['VVIP DESK', $watumishi, 2000000, 10000000, 30, Duration::Monthly, 1, 2, false, 'hq', 100, 100, 0, 0],
            ['WATUMISHI LOAN', $watumishi, 100000, 500000, 20, Duration::Monthly, 1, 3, true, 'branch', 50, 70, 5000, 5000],
        ];

        foreach ($products as [$name, $main, $from, $to, $rate, $duration, $repFrom, $repTo, $feeDeduct, $approve, $topup, $takeHome, $fee, $insurance]) {
            $category = LoanCategory::updateOrCreate(['company_id' => $company->id, 'name' => $name], [
                'main_category_id' => $main->id,
                'amount_from' => $from,
                'amount_to' => $to,
                'interest_rate' => $rate,
                'formula' => 'SIMPLE',
                'duration' => $duration,
                'repayment_from' => $repFrom,
                'repayment_to' => $repTo,
                'fee_deduct' => $feeDeduct,
                'has_penalty' => true,
                'approve_level' => $approve,
                'topup_percent' => $topup,
                'take_home_percent' => $takeHome,
                'fee_type' => 'money',
                'fee_value' => $fee,
                'insurance' => $insurance,
            ]);
            $category->branches()->syncWithoutDetaching($branches->pluck('id'));
        }

        $this->seedCustomerCategories($company);

        Group::firstOrCreate(['company_id' => $company->id, 'name' => 'WAZURI']);

        foreach (['NMB', 'CRDB'] as $bank) {
            BankAccount::firstOrCreate(['company_id' => $company->id, 'name' => $bank]);
        }

        foreach (['branch' => ['umeme', 'MAJI', 'SODA'], 'bank' => ['MISHAHARA'], 'hq' => ['MAFUTA']] as $scope => $names) {
            foreach ($names as $name) {
                ExpenseType::firstOrCreate(['company_id' => $company->id, 'scope' => $scope, 'name' => $name]);
            }
        }

        PaymentMode::firstOrCreate(['company_id' => $company->id, 'name' => 'M-PESA']);

        SalaryAdvanceCategory::firstOrCreate(['company_id' => $company->id, 'name' => 'WATUMISHI'], ['interest_rate' => 20, 'amount_from' => 10000, 'amount_to' => 30000, 'fee' => 200]);
        StaffLoanCategory::firstOrCreate(['company_id' => $company->id, 'name' => 'TEST1'], ['amount_from' => 1000, 'amount_to' => 10000, 'interest_rate' => 20, 'duration' => 'monthly', 'repayment_from' => 1, 'repayment_to' => 3, 'fee' => 0]);
        StaffSalaryAdvanceCategory::firstOrCreate(['company_id' => $company->id, 'name' => 'SALARY ADVANCE STAFF'], ['amount_from' => 10000, 'amount_to' => 100000, 'fee' => 200]);
    }

    /**
     * The five customer categories and their dynamic forms (Documents/customer-types.json).
     * Loan limits, allowed products, required documents and risk levels are defaults the
     * business can change under Settings.
     */
    private function seedCustomerCategories(Company $company): void
    {
        $definition = json_decode((string) file_get_contents(database_path('data/customer-types.json')), true);
        $rules = [
            'mtumishi_umma' => ['risk' => 'low', 'min' => 100000, 'max' => 10000000, 'products' => ['WATUMISHI 2', 'WATUMISHI 3', 'NEW WATUMISHI 1', 'NEW WATUMISHI 2', 'NEW WATUMISHI 3', 'VIP DESK', 'VVIP DESK', 'WATUMISHI LOAN'], 'documents' => ['Salary slip', 'Employment ID', 'NIDA']],
            'sekta_binafsi' => ['risk' => 'medium', 'min' => 100000, 'max' => 5000000, 'products' => ['WATUMISHI 2', 'NEW WATUMISHI 1', 'NEW WATUMISHI 2', 'WATUMISHI LOAN'], 'documents' => ['Salary slip', 'Employment contract', 'Employment ID', 'NIDA']],
            'mjasiriamali' => ['risk' => 'high', 'min' => 20000, 'max' => 2000000, 'products' => ['WAJASILIAMALI', 'GROUP LOAN', 'VIKUNDI 1', 'VIKUNDI 2'], 'documents' => ['Business licence', 'TIN certificate', 'Collateral (Dhamana)', 'NIDA']],
            'mwanafunzi' => ['risk' => 'high', 'min' => 20000, 'max' => 500000, 'products' => ['WAJASILIAMALI'], 'documents' => ['Student ID', 'Admission letter', 'Guarantor NIDA', 'NIDA']],
            'mstaafu' => ['risk' => 'medium', 'min' => 100000, 'max' => 3000000, 'products' => ['NEW WATUMISHI 1', 'NEW WATUMISHI 2', 'WATUMISHI LOAN'], 'documents' => ['Pension statement', 'Retirement letter', 'NIDA']],
        ];

        foreach ($definition['types'] as $type) {
            $rule = $rules[$type['key']];
            $category = CustomerCategory::updateOrCreate(['company_id' => $company->id, 'key' => $type['key']], [
                'name' => $type['label'],
                'icon' => $type['icon'] ?? null,
                'section_title' => $type['sectionTitle'] ?? null,
                'risk_level' => $rule['risk'],
                'min_loan_amount' => $rule['min'],
                'max_loan_amount' => $rule['max'],
                'required_documents' => $rule['documents'],
                'form_schema' => $type['fields'],
            ]);

            $category->loanCategories()->sync(LoanCategory::where('company_id', $company->id)->whereIn('name', $rule['products'])->pluck('id'));
        }
    }

    private function region(string $name): int
    {
        return array_search($name, self::REGIONS, true) + 1;
    }
}
