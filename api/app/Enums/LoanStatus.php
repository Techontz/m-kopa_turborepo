<?php

namespace App\Enums;

enum LoanStatus: string
{
    case Pending = 'pending';
    case Disbursed = 'disbursed';
    case Active = 'active';
    case Done = 'done';
    case Default = 'default';
    case Rejected = 'rejected';
    case WrittenOff = 'written_off';

    /**
     * Label as displayed on the live system (including its spelling).
     */
    public function label(): string
    {
        return match ($this) {
            self::Pending => 'PENDING',
            self::Disbursed => 'DISBURSED',
            self::Active => 'ACTIVE',
            self::Done => 'DONE',
            self::Default => 'DEFALT',
            self::Rejected => 'REJECTED',
            self::WrittenOff => 'WRITE-OFF',
        };
    }

    public function badge(): string
    {
        return match ($this) {
            self::Pending => 'warning',
            self::Disbursed => 'info',
            self::Active => 'success',
            self::Done => 'primary',
            self::Default, self::Rejected, self::WrittenOff => 'danger',
        };
    }
}
