<?php

namespace App\Models;

use App\Enums\Account;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One disbursement attempt (batch) for a loan. Retries create a new row with a new batch id.
 *
 * The source account is where the money is paid from: SOURCE_CASH is the loan branch's PRINCIPAL A/C (the branch
 * lending cash fund that the COMPANY ACCOUNT floats money into), SOURCE_BANK is a company bank account.
 */
class LoanDisbursement extends Model
{
    public const PREPARED = 'prepared';

    public const REQUESTED = 'requested';

    public const SUCCESS = 'success';

    public const FAILED = 'failed';

    public const CANCELLED = 'cancelled';

    public const SOURCE_CASH = 'cash';

    public const SOURCE_BANK = 'bank';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'callback_payload' => 'array',
            'requested_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'prepared_by');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'requested_by');
    }

    public function sourceBankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class, 'source_bank_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }

    /**
     * Ledger account the disbursement is credited to (legacy rows without a source were paid from PRINCIPAL A/C).
     *
     * @return array{account: Account, branch?: int|null, bank?: int|null}
     */
    public function ledgerSource(): array
    {
        return $this->source_account === self::SOURCE_BANK
            ? ['account' => Account::Bank, 'bank' => (int) $this->source_bank_account_id]
            : ['account' => Account::Principal, 'branch' => (int) $this->branch_id];
    }

    /**
     * "PRINCIPAL A/C (CASH) - Kariakoo" or "BANK - NMB".
     */
    public function sourceLabel(): string
    {
        return $this->source_account === self::SOURCE_BANK
            ? trim(Account::Bank->label().' - '.$this->sourceBankAccount?->name, ' -')
            : Account::Principal->label().' (CASH)'.($this->branch ? ' - '.$this->branch->name : '');
    }
}
