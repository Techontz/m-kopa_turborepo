<?php

namespace App\Http\Resources\Api\V1\Settings;

use App\Models\CustomerCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CustomerCategory
 */
class CustomerCategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'name' => $this->name,
            'icon' => $this->icon,
            'section_title' => $this->section_title,
            'risk_level' => $this->risk_level,
            'min_loan_amount' => (float) $this->min_loan_amount,
            'max_loan_amount' => (float) $this->max_loan_amount,
            'required_documents' => $this->required_documents ?? [],
            'is_active' => $this->is_active,
            'fields_count' => count($this->form_schema ?? []),
            'form_schema' => $this->when($request->routeIs('*.customer-categories.show'), fn () => $this->form_schema ?? []),
            'loan_categories' => $this->whenLoaded('loanCategories', fn () => $this->loanCategories->map(fn ($product): array => ['id' => $product->id, 'name' => $product->name])->values()),
        ];
    }
}
