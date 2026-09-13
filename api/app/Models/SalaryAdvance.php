<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalaryAdvance extends Model
{
    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'total_payable' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvanceCategory::class, 'salary_advance_category_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(SalaryAdvancePayment::class);
    }

    protected function paidAmount(): Attribute
    {
        return Attribute::get(fn (): float => (float) ($this->payments_sum_amount ?? $this->payments()->sum('amount')));
    }

    protected function remainingAmount(): Attribute
    {
        return Attribute::get(fn (): float => max(0, (float) $this->total_payable - $this->paid_amount));
    }
}
