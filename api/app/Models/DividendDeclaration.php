<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A monthly profit distribution: reinvested share (to Principal) and shareholder dividend.
 */
class DividendDeclaration extends Model
{
    use Auditable;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period' => 'date',
            'profit_amount' => 'decimal:2',
            'reinvest_percent' => 'decimal:2',
            'reinvest_amount' => 'decimal:2',
            'dividend_percent' => 'decimal:2',
            'dividend_amount' => 'decimal:2',
        ];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(DividendAllocation::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    public function declaredBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'declared_by');
    }
}
