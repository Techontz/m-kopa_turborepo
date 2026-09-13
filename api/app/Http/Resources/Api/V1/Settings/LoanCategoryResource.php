<?php

namespace App\Http\Resources\Api\V1\Settings;

use App\Models\LoanCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LoanCategory
 */
class LoanCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'main_category_id' => $this->main_category_id,
            'main_category' => $this->whenLoaded('mainCategory', fn () => $this->mainCategory?->name),
            'amount_from' => (float) $this->amount_from,
            'amount_to' => (float) $this->amount_to,
            'level_label' => $this->level_label,
            'interest_rate' => (float) $this->interest_rate,
            'formula' => $this->formula,
            'duration' => $this->duration?->value,
            'duration_label' => $this->duration?->label(),
            'repayment_from' => $this->repayment_from,
            'repayment_to' => $this->repayment_to,
            'fee_deduct' => $this->fee_deduct,
            'has_penalty' => $this->has_penalty,
            'approve_level' => $this->approve_level,
            'requires_mandate' => (bool) $this->requires_mandate,
            'topup_percent' => (float) $this->topup_percent,
            'take_home_percent' => (float) $this->take_home_percent,
            'fee_type' => $this->fee_type,
            'fee_value' => (float) $this->fee_value,
            'insurance' => (float) $this->insurance,
            'branches' => $this->whenLoaded('branches', fn () => $this->branches->map(fn ($branch): array => ['id' => $branch->id, 'name' => $branch->name])->values()),
            'customer_categories' => $this->whenLoaded('customerCategories', fn () => $this->customerCategories->map(fn ($category): array => ['id' => $category->id, 'name' => $category->name])->values()),
        ];
    }
}
