<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Customer category acting as a rule engine: allowed loan products, loan limits,
 * required documents, risk level and dynamic registration form (form_schema).
 */
class CustomerCategory extends Model
{
    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'min_loan_amount' => 'decimal:2',
            'max_loan_amount' => 'decimal:2',
            'required_documents' => 'array',
            'form_schema' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function loanCategories(): BelongsToMany
    {
        return $this->belongsToMany(LoanCategory::class);
    }
}
