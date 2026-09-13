<?php

namespace App\Models;

use App\Enums\Account;
use App\Models\Concerns\Auditable;
use App\Services\ShareholderOwnership;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One shareholder capital contribution. Rows are never overwritten: every contribution is its own row, posted
 * Dr receiving company account (COMPANY ACCOUNT for CASH, the selected bank account for BANK) / Cr CAPITAL ACCOUNT.
 * Ownership is derived from these rows only ({@see ShareholderOwnership}).
 */
class Capital extends Model
{
    use Auditable;

    /**
     * Private disk holding uploaded receipts (served only through the authorised API).
     */
    public const DISK = 'local';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'contributed_at' => 'datetime',
        ];
    }

    public function shareHolder(): BelongsTo
    {
        return $this->belongsTo(ShareHolder::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'recorded_by');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    /**
     * "COMPANY ACCOUNT" or "BANK - NMB"; null for legacy rows whose posting could not be traced.
     */
    public function receivingAccountLabel(): ?string
    {
        return match ($this->receiving_account) {
            Account::Company->value => Account::Company->label(),
            Account::Bank->value => trim(Account::Bank->label().' - '.$this->bankAccount?->name, ' -'),
            default => null,
        };
    }
}
