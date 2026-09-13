<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Company-wide HRM parameters (STAFF COMMISSION §7 "Commission Pool = % × Distributable Profit",
 * §8 zone manager override %, §12 staff fund "% ya salary"; attendance start time).
 */
class HrmSetting extends Model
{
    use Auditable;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'commission_pool_percent' => 'decimal:2',
            'zone_override_percent' => 'decimal:2',
            'staff_fund_percent' => 'decimal:2',
        ];
    }

    public static function forCompany(int $companyId): self
    {
        return self::firstOrCreate(['company_id' => $companyId]);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
