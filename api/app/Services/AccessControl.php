<?php

namespace App\Services;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Employee;
use App\Models\Role;
use Illuminate\Database\Eloquent\Builder;

/**
 * Role permissions and data scoping (company / zone / branch).
 */
class AccessControl
{
    /**
     * Seed the default roles from config/permissions.php for a company.
     */
    public function seedRoles(Company $company): void
    {
        foreach (config('permissions.roles') as $key => $definition) {
            $role = Role::updateOrCreate(
                ['company_id' => $company->id, 'key' => $key],
                ['name' => $definition['name'], 'is_system' => true],
            );

            $permissions = $definition['permissions'] === ['*'] ? array_keys(config('permissions.permissions')) : $definition['permissions'];
            foreach ($permissions as $permission) {
                $role->permissions()->firstOrCreate(['permission' => $permission]);
            }
        }
    }

    /**
     * @return list<string>
     */
    public function permissionsFor(Employee $employee): array
    {
        if ($employee->role === null) {
            return [];
        }

        if ($employee->role->key === 'super_admin') {
            return array_keys(config('permissions.permissions'));
        }

        return $employee->role->permissions->pluck('permission')->values()->all();
    }

    public function can(Employee $employee, string $permission): bool
    {
        return in_array($permission, $this->permissionsFor($employee), true);
    }

    /**
     * Branch ids the employee may see; null means every branch of the company.
     *
     * @return list<int>|null
     */
    public function branchIds(Employee $employee): ?array
    {
        return match ($employee->role?->scope ?? 'branch') {
            'company' => null,
            'zone' => $employee->zone_id ? Branch::where('zone_id', $employee->zone_id)->pluck('id')->all() : [],
            default => $employee->branch_id ? [(int) $employee->branch_id] : [],
        };
    }

    /**
     * Restrict a query on a table with a branch_id column to the employee's data scope.
     *
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    public function scope(Builder $query, Employee $employee, string $column = 'branch_id'): Builder
    {
        $query->where($query->getModel()->qualifyColumn('company_id'), $employee->company_id);

        $branchIds = $this->branchIds($employee);

        return $branchIds === null ? $query : $query->whereIn($query->getModel()->qualifyColumn($column), $branchIds);
    }
}
