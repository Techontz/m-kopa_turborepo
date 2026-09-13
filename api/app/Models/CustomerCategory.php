<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Customer category acting as a rule engine: allowed loan products, loan limits,
 * required documents, risk level and dynamic registration form (form_schema).
 */
class CustomerCategory extends Model
{
    use Auditable, SoftDeletes;

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
            'optional_documents' => 'array',
            'dynamic_form_schema' => 'array',
            'omitted_standard_fields' => 'array',
            'sort_order' => 'integer',
            'requires_sector' => 'boolean',
            'requires_employer' => 'boolean',
            'requires_contract' => 'boolean',
            'requires_salary' => 'boolean',
            'requires_extra_approval' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function loanCategories(): BelongsToMany
    {
        return $this->belongsToMany(LoanCategory::class);
    }
}
