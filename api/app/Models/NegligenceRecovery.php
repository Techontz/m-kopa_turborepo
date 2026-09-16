<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One recovery of a negligence deduction from the commission paid by a payroll (spec §57): the commission of that period,
 * the amount recovered into the PRINCIPAL A/C and the balance still outstanding afterwards.
 */
class NegligenceRecovery extends Model
{
    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'period' => 'date',
            'commission' => 'decimal:2',
            'amount' => 'decimal:2',
            'outstanding_after' => 'decimal:2',
        ];
    }

    public function negligenceDeduction(): BelongsTo
    {
        return $this->belongsTo(NegligenceDeduction::class);
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }

    public function salaryPayment(): BelongsTo
    {
        return $this->belongsTo(SalaryPayment::class);
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(JournalEntry::class);
    }
}
