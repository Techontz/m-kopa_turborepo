<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Legacy loan sub category of a main loan category (live "Sub category Loan": HAZINA, BINAFSI, WASTAFU, VIP, VIKUNDI…).
 * Stored in the historical table `customer_types`; it is NOT the Customer Type (customer_categories) and no loan, customer or
 * loan category references it.
 */
class LoanSubCategory extends Model
{
    public $timestamps = false;

    protected $table = 'customer_types';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_enabled' => 'boolean',
        ];
    }

    public function mainCategory(): BelongsTo
    {
        return $this->belongsTo(MainCategory::class);
    }
}
