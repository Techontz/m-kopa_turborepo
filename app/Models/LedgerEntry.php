<?php

namespace App\Models;

use App\Enums\Account;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class LedgerEntry extends Model
{
    protected $guarded = ['id'];

    /**
     * @return array<string, string|class-string>
     */
    protected function casts(): array
    {
        return [
            'account' => Account::class,
            'amount' => 'decimal:2',
            'entry_date' => 'date',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
