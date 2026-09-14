<?php

namespace App\Http\Controllers\Api\V1\Hrm;

use App\Http\Requests\Api\Hrm\StaffPrivilegesRequest;
use App\Models\AuditLog;
use App\Models\Employee;
use App\Services\AccessControl;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

/**
 * HRM → All Active Staff → Privilege (live admin/privillage/:id): the permissions one employee holds.
 *
 * Live grants privileges per user; here they are per-employee overrides on top of the role's permissions, resolved by
 * AccessControl (effective = role + granted − revoked) so every Gate check honours them. Guards: nobody edits their
 * own privileges, the Super Admin always has full access, and an administrator can only grant or revoke permissions
 * they hold themselves.
 */
class StaffPrivilegeController extends HrmController
{
    public function __construct(private readonly AccessControl $access) {}

    public function show(Employee $employee): JsonResponse
    {
        $this->authorizeAny('hrm.staff_privileges', 'users.manage', 'hrm.manage');
        $this->ensureVisible($employee);

        return response()->json(['data' => $this->payload($employee)]);
    }

    public function update(StaffPrivilegesRequest $request, Employee $employee): JsonResponse
    {
        $actor = $this->currentEmployee();

        abort_if($employee->is($actor), 403, 'You cannot change your own privileges.');
        abort_if($employee->role?->key === 'super_admin', 422, 'The Super Admin has full access; privileges cannot be changed.');

        $before = $this->access->permissionsFor($employee);
        $desired = $request->permissions();
        $changed = array_values(array_unique([...array_diff($desired, $before), ...array_diff($before, $desired)]));

        $notHeld = array_values(array_diff($changed, $this->access->permissionsFor($actor)));
        abort_if($notHeld !== [], 403, 'You cannot grant or revoke privileges you do not hold: '.implode(', ', $notHeld).'.');

        if ($changed !== []) {
            DB::transaction(function () use ($employee, $actor, $before, $desired, $request): void {
                $this->access->syncEmployeePermissions($employee, $desired);

                AuditLog::create([
                    'company_id' => $employee->company_id,
                    'employee_id' => $actor->id,
                    'action' => 'Employee.privileges_updated',
                    'auditable_type' => $employee->getMorphClass(),
                    'auditable_id' => $employee->id,
                    'before' => ['permissions' => $before],
                    'after' => [
                        'granted' => array_values(array_diff($desired, $before)),
                        'revoked' => array_values(array_diff($before, $desired)),
                        'permissions' => $this->access->permissionsFor($employee),
                    ],
                    'ip_address' => $request->ip(),
                ]);
            });
        }

        return $this->message('Staff Privileges Updated successfully', 200, ['data' => $this->payload($employee)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Employee $employee): array
    {
        $employee->load(['branch', 'role.permissions', 'permissionOverrides']);
        $actor = $this->currentEmployee();
        $isSuperAdmin = $employee->role?->key === 'super_admin';

        $readOnlyReason = match (true) {
            ! Gate::allows('hrm.staff_privileges') => 'You can view these privileges but not change them.',
            $employee->is($actor) => 'You cannot change your own privileges.',
            $isSuperAdmin => 'The Super Admin has full access; privileges cannot be changed.',
            default => null,
        };

        $overrides = $employee->permissionOverrides;

        return [
            'employee' => [
                'id' => $employee->id,
                'employee_number' => $employee->employee_number,
                'full_name' => $employee->full_name,
                'username' => $employee->username,
                'phone' => $employee->phone,
                'branch' => $employee->branch?->name,
                'position' => $employee->position,
                'status' => $employee->status,
                'role' => $employee->role ? ['id' => $employee->role->id, 'key' => $employee->role->key, 'name' => $employee->role->name, 'scope' => $employee->role->scope] : null,
                'zone_id' => $employee->zone_id,
            ],
            'catalogue' => collect(config('permissions.permissions'))
                ->map(fn (string $label, string $key): array => ['key' => $key, 'label' => $label, 'group' => explode('.', $key)[0]])
                ->values(),
            'role_permissions' => $this->access->rolePermissionsFor($employee),
            'granted' => $isSuperAdmin ? [] : $overrides->where('granted', true)->pluck('permission')->values(),
            'revoked' => $isSuperAdmin ? [] : $overrides->where('granted', false)->pluck('permission')->values(),
            'permissions' => $this->access->permissionsFor($employee),
            'can_edit' => $readOnlyReason === null,
            'read_only_reason' => $readOnlyReason,
            'actor_permissions' => $this->access->permissionsFor($actor),
            // Same rules as Settings → Roles & Permissions → assign role (PUT settings/employees/{employee}/role).
            'can_change_role' => (Gate::allows('users.manage') || Gate::allows('hrm.manage')) && ! $employee->is($actor)
                && (! $isSuperAdmin || $actor->role?->key === 'super_admin'),
        ];
    }
}
