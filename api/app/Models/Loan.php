<?php

namespace App\Models;

use App\Enums\Duration;
use App\Enums\LoanStatus;
use App\Services\LoanService;
use Database\Factories\LoanFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Loan extends Model
{
    /** @use HasFactory<LoanFactory> */
    use HasFactory;

    protected $guarded = ['id'];

    /**
     * @return array<string, string|class-string>
     */
    protected function casts(): array
    {
        return [
            'amount_applied' => 'decimal:2',
            'amount_approved' => 'decimal:2',
            'instalment' => 'decimal:2',
            'interest_rate' => 'decimal:2',
            'interest_amount' => 'decimal:2',
            'total_payable' => 'decimal:2',
            'loan_fee' => 'decimal:2',
            'insurance' => 'decimal:2',
            'restoration' => 'decimal:2',
            'fee_deduct' => 'boolean',
            'is_special' => 'boolean',
            'approved_at' => 'datetime',
            'withdrawn_at' => 'date',
            'end_date' => 'date',
            'status' => LoanStatus::class,
            'duration' => Duration::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(LoanCategory::class, 'loan_category_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function guarantors(): HasMany
    {
        return $this->hasMany(Guarantor::class);
    }

    public function collaterals(): HasMany
    {
        return $this->hasMany(Collateral::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(LoanSchedule::class)->orderBy('due_date');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(LoanTransaction::class);
    }

    public function penalties(): HasMany
    {
        return $this->hasMany(Penalty::class);
    }

    public function writeOff(): HasOne
    {
        return $this->hasOne(WriteOff::class);
    }

    /**
     * @param  Builder<Loan>  $query
     */
    public function scopeStatus(Builder $query, LoanStatus ...$statuses): void
    {
        $query->whereIn('status', array_map(fn (LoanStatus $status): string => $status->value, $statuses));
    }

    protected function paidAmount(): Attribute
    {
        return Attribute::get(fn (): float => (float) $this->transactions()->where('type', 'deposit')->sum('amount'));
    }

    /**
     * Outstanding principal + penalty + interest + insurance (see LoanService::outstanding()).
     */
    protected function remainingAmount(): Attribute
    {
        return Attribute::get(fn (): float => app(LoanService::class)->outstanding($this)['total']);
    }
}
