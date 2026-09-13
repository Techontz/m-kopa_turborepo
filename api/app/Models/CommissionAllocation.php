<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Commission earned by one employee for a closed accounting period (STAFF COMMISSION §7–8).
 * kind = branch_staff (share of a branch pool) or zone_manager (override on the zone's pools).
 */
class CommissionAllocation extends Model
{
    public const KIND_BRANCH_STAFF = 'branch_staff';

    public const KIND_ZONE_MANAGER = 'zone_manager';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'distributable_profit' => 'decimal:2',
            'pool_percent' => 'decimal:2',
            'pool_amount' => 'decimal:2',
            'base_salary' => 'decimal:2',
            'total_salary' => 'decimal:2',
            'share_percent' => 'decimal:4',
            'amount' => 'decimal:2',
        ];
    }

    public function period(): BelongsTo
    {
        return $this->belongsTo(AccountingPeriod::class, 'accounting_period_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class);
    }
}
