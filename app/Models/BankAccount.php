<?php

namespace App\Models;

use App\Enums\Account;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankAccount extends Model
{
    protected $guarded = ['id'];

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(LedgerEntry::class);
    }

    /**
     * Current ledger balance of this bank account.
     */
    public function balance(): float
    {
        return app(Ledger::class)->balance($this->company_id, Account::Bank, bankAccount: $this);
    }
}
