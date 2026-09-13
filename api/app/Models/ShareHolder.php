<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShareHolder extends Model
{
    use Auditable;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
        ];
    }

    public function capitals(): HasMany
    {
        return $this->hasMany(Capital::class);
    }

    public function dividendAllocations(): HasMany
    {
        return $this->hasMany(DividendAllocation::class);
    }
}
