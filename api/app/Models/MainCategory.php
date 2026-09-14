<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Main loan category: the top-level loan group of exactly one customer type (1:1, customer_category_id). Its name is the
 * customer type's name — the `name` column is kept in sync by CustomerCategory and never edited on its own.
 */
class MainCategory extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    public function customerType(): BelongsTo
    {
        return $this->belongsTo(CustomerCategory::class, 'customer_category_id')->withTrashed();
    }

    /**
     * Legacy live sub categories (table customer_types).
     */
    public function subCategories(): HasMany
    {
        return $this->hasMany(LoanSubCategory::class);
    }

    public function loanCategories(): HasMany
    {
        return $this->hasMany(LoanCategory::class);
    }

    /**
     * Main loan categories whose customer type still exists (not deleted), in the customer types' display order.
     */
    public function scopeListed(Builder $query, int $companyId): void
    {
        $query->select('main_categories.*')
            ->join('customer_categories', 'customer_categories.id', '=', 'main_categories.customer_category_id')
            ->where('main_categories.company_id', $companyId)
            ->whereNull('customer_categories.deleted_at')
            ->orderBy('customer_categories.sort_order')
            ->orderBy('customer_categories.name');
    }

    /**
     * Display name, always derived from the customer type.
     */
    protected function displayName(): Attribute
    {
        return Attribute::get(fn (): string => $this->customerType?->name ?? $this->name);
    }
}
