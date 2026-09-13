<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MainCategory extends Model
{
    public $timestamps = false;

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

    public function customerTypes(): HasMany
    {
        return $this->hasMany(CustomerType::class);
    }

    public function loanCategories(): HasMany
    {
        return $this->hasMany(LoanCategory::class);
    }
}
