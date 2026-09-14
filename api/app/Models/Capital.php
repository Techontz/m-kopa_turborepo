<?php

namespace App\Models;

use App\Enums\Account;
use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * One shareholder capital contribution. Rows are never overwritten: every contribution is its own row, posted
 * Dr receiving company account (COMPANY ACCOUNT for CASH, the selected bank account for BANK) / Cr CAPITAL ACCOUNT.
 * Contributions are financial transactions; ownership comes from the share register (share transactions), which may
 * link a contribution to the shares it paid for.
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

    /**
     * Share transactions (issuance / initial allocation) this contribution paid for.
     */
    public function shareTransactions(): HasMany
    {
        return $this->hasMany(ShareTransaction::class);
    }

    /**
     * Store (or replace) the receipt document on the private disk.
     */
    public function attachReceipt(UploadedFile $file): void
    {
        $previous = $this->receipt_file;
        $this->update([
            'receipt_file' => $file->store("capital-receipts/{$this->company_id}", self::DISK),
            'receipt_file_name' => mb_substr(basename($file->getClientOriginalName()), 0, 191),
        ]);

        if ($previous) {
            Storage::disk(self::DISK)->delete($previous);
        }
    }
}
