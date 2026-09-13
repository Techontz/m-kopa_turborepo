<?php

namespace Tests;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create a company with one branch and sign in as its admin.
     */
    protected function signInAdmin(): Employee
    {
        $company = Company::factory()->create();
        $branch = Branch::factory()->create(['company_id' => $company->id]);
        $admin = Employee::factory()->admin()->create(['company_id' => $company->id, 'branch_id' => $branch->id]);

        $this->actingAs($admin);

        return $admin;
    }
}
