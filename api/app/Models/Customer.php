<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use Auditable, HasFactory;

    /**
     * Customer lifecycle statuses (live values: pending / open / out / close).
     *
     * @var array<string, string>
     */
    public const STATUSES = [
        'pending' => 'PENDING',
        'open' => 'ACTIVE',
        'out' => 'DEFAULT',
        'close' => 'CLOSED',
    ];

    /**
     * @var array<string, string>
     */
    public const WORK_STATUSES = [
        'ent' => 'Watumishi',
        'ser' => 'Wajasiliamali',
    ];

    /**
     * @var list<string>
     */
    public const MARITAL_STATUSES = ['Married', 'Single', 'Widow', 'Separated', 'Devorced'];

    /** Registration wizard steps. */
    public const STEP_BASIC = 1;

    public const STEP_ADDITIONAL = 2;

    public const STEP_PASSPORT = 3;

    public const STEP_COMPLETE = 4;

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'monthly_income' => 'decimal:2',
            'is_marked' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (Customer $customer): void {
            if ($customer->customer_code === null) {
                $customer->forceFill(['customer_code' => 'C'.$customer->created_at->format('Ym').$customer->id])->saveQuietly();
            }
        });
    }

    protected function fullName(): Attribute
    {
        return Attribute::get(fn (): string => trim("{$this->first_name} {$this->middle_name} {$this->last_name}"));
    }

    /**
     * Middle name shortened to its initial, as on the live profile headers ("FARYJALLAH M JOHN").
     */
    protected function shortName(): Attribute
    {
        return Attribute::get(fn (): string => trim($this->first_name.' '.mb_substr((string) $this->middle_name, 0, 1).' '.$this->last_name));
    }

    protected function statusLabel(): Attribute
    {
        return Attribute::get(fn (): string => self::STATUSES[$this->status] ?? strtoupper((string) $this->status));
    }

    protected function photoUrl(): Attribute
    {
        return Attribute::get(fn (): string => $this->passport_photo ? asset('storage/'.$this->passport_photo) : '/assets/img/default.jpeg');
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function customerCategory(): BelongsTo
    {
        return $this->belongsTo(CustomerCategory::class);
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function guarantors(): HasMany
    {
        return $this->hasMany(Guarantor::class);
    }

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(LoanTransaction::class);
    }

    public function savings(): HasMany
    {
        return $this->hasMany(Saving::class);
    }

    public function kyc(): HasOne
    {
        return $this->hasOne(CustomerKyc::class);
    }

    public function nextOfKin(): HasOne
    {
        return $this->hasOne(CustomerNextOfKin::class);
    }

    public function residence(): HasOne
    {
        return $this->hasOne(CustomerResidence::class);
    }

    public function bankDetail(): HasOne
    {
        return $this->hasOne(CustomerBankDetail::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(CustomerDocument::class);
    }

    public function salaryAdvances(): HasMany
    {
        return $this->hasMany(SalaryAdvance::class);
    }

    /**
     * URL of the first incomplete registration step, or null when registration is complete.
     */
    public function nextRegistrationUrl(): ?string
    {
        return match (true) {
            $this->registration_step <= self::STEP_ADDITIONAL => route('customers.additional', $this),
            $this->registration_step === self::STEP_PASSPORT => route('customers.passport', $this),
            default => null,
        };
    }
}
