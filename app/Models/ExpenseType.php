<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExpenseType extends Model
{
    protected $guarded = ['id'];

    public function requests(): HasMany
    {
        return $this->hasMany(ExpenseRequest::class);
    }
}
