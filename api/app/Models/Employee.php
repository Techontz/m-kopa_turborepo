<?php

namespace App\Models;

use Database\Factories\EmployeeFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class Employee extends Authenticatable
{
    /** @use HasFactory<EmployeeFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Privileges an employee can be granted (HRM → privillage page).
     *
     * @var array<string, string>
     */
    public const PRIVILEGES = [
        'apply' => 'APPLY LOAN',
        'aprove' => 'APROVE',
        'bank' => 'BANK',
        'bank_password' => 'BANK PASSWORD',
        'clientless' => 'CLIENTLESS',
        'customer' => 'CUSTOMER',
        'debit' => 'DEBIT PENDING',
        'expenses' => 'EXPENSES',
        'float' => 'FLOAT',
        'group' => 'GROUP',
        'loan' => 'LOAN',
        'report' => 'REPORT',
        'saving' => 'SAVING',
        'teller' => 'TELLER',
    ];

    /**
     * @var array<string, string>
     */
    public const POSITIONS = [
        'employee' => 'Employee',
        'hq' => 'Hq',
        'zone' => 'Zone',
        'admin' => 'Admin',
    ];

    protected $guarded = ['id'];

    /**
     * @var list<string>
     */
    protected $hidden = ['password', 'remember_token'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'password' => 'hashed',
        ];
    }

    protected function fullName(): Attribute
    {
        return Attribute::get(fn (): string => trim(implode(' ', array_filter([$this->first_name, $this->middle_name, $this->last_name]))));
    }

    protected function photoUrl(): Attribute
    {
        return Attribute::get(fn (): string => $this->photo ? asset('storage/'.$this->photo) : asset('assets/img/male.jpeg'));
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function zone(): BelongsTo
    {
        return $this->belongsTo(Zone::class);
    }

    /**
     * @return list<string>
     */
    public function permissionKeys(): array
    {
        return app(\App\Services\AccessControl::class)->permissionsFor($this);
    }

    public function privileges(): HasMany
    {
        return $this->hasMany(EmployeePrivilege::class);
    }

    public function salaryInfo(): HasOne
    {
        return $this->hasOne(EmployeeSalary::class);
    }

    public function allowances(): HasMany
    {
        return $this->hasMany(StaffAllowance::class);
    }

    public function deductions(): HasMany
    {
        return $this->hasMany(StaffDeduction::class);
    }

    public function staffLoans(): HasMany
    {
        return $this->hasMany(StaffLoan::class);
    }

    public function salaryAdvances(): HasMany
    {
        return $this->hasMany(StaffSalaryAdvance::class);
    }

    public function salaryPayments(): HasMany
    {
        return $this->hasMany(SalaryPayment::class);
    }
}
