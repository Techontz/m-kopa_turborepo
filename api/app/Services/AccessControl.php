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
     * Effective permissions: the role's permissions plus the employee's granted overrides minus the revoked ones.
     * The system Super Admin always holds every permission (overrides do not apply). Unknown keys are ignored.
     *
     * @return list<string>
     */
    public function permissionsFor(Employee $employee): array
    {
        if ($employee->role?->key === 'super_admin') {
            return array_keys(config('permissions.permissions'));
        }

        $overrides = $employee->permissionOverrides;
        $granted = $overrides->where('granted', true)->pluck('permission')->all();
        $revoked = $overrides->where('granted', false)->pluck('permission')->all();

        $effective = array_diff(array_unique([...$this->rolePermissionsFor($employee), ...$granted]), $revoked);

        return array_values(array_intersect(array_keys(config('permissions.permissions')), $effective));
    }

    /**
     * Permissions coming from the employee's role alone (no per-employee overrides).
     *
     * @return list<string>
     */
    public function rolePermissionsFor(Employee $employee): array
    {
        if ($employee->role === null) {
            return [];
        }

        if ($employee->role->key === 'super_admin') {
            return array_keys(config('permissions.permissions'));
        }

        return $employee->role->permissions->pluck('permission')->values()->all();
    }

    /**
     * Store the employee's overrides so that their effective permissions become exactly $desired, and drop the
     * cached relations so the next check in this request resolves the new set.
     *
     * @param  list<string>  $desired
     */
    public function syncEmployeePermissions(Employee $employee, array $desired): void
    {
        $role = $this->rolePermissionsFor($employee);
        $overrides = [
            ...array_fill_keys(array_values(array_diff($desired, $role)), true),
            ...array_fill_keys(array_values(array_diff($role, $desired)), false),
        ];

        $employee->permissionOverrides()->whereNotIn('permission', array_keys($overrides))->delete();
        foreach ($overrides as $permission => $granted) {
            $employee->permissionOverrides()->updateOrCreate(['permission' => $permission], ['granted' => $granted]);
        }

        $this->forgetCachedPermissions($employee);
    }

    /**
     * Permissions are resolved from the employee's loaded relations (no application cache); unset them so a change
     * made in this request is visible immediately.
     */
    public function forgetCachedPermissions(Employee $employee): void
    {
        $employee->unsetRelation('permissionOverrides');
        $employee->role?->unsetRelation('permissions');
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
