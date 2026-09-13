<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use Illuminate\Database\Eloquent\Collection;

abstract class Controller
{
    protected function employee(): Employee
    {
        /** @var Employee */
        return auth()->user();
    }

    protected function company(): Company
    {
        return $this->employee()->company;
    }

    /**
     * @return Collection<int, Branch>
     */
    protected function branches(): Collection
    {
        return Branch::where('company_id', $this->employee()->company_id)->orderBy('id')->get();
    }
}
