<?php

namespace Database\Factories;

use App\Enums\Duration;
use App\Models\Company;
use App\Models\LoanCategory;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LoanCategory>
 */
class LoanCategoryFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'company_id' => Company::factory(),
            'name' => 'WAJASILIAMALI',
            'amount_from' => 20000,
            'amount_to' => 2000000,
            'interest_rate' => 30,
            'formula' => 'SIMPLE',
            'duration' => Duration::Weekly,
            'repayment_from' => 1,
            'repayment_to' => 3,
            'fee_deduct' => true,
            'has_penalty' => true,
            'approve_level' => 'hq',
            'topup_percent' => 50,
            'take_home_percent' => 70,
            'fee_type' => 'money',
            'fee_value' => 5000,
            'insurance' => 0,
        ];
    }
}
