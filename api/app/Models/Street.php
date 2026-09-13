<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Mtaa (street / village) under a ward. all-ward.json stops at Kata level, so streets are
 * collected as officers register customers and become selectable for later registrations.
 */
class Street extends Model
{
    protected $guarded = ['id'];
}
