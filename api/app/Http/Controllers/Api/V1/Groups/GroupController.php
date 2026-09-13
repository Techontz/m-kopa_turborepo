<?php

namespace App\Http\Controllers\Api\V1\Groups;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Group;
use App\Models\Loan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Group → All groups (admin/group) and the group customer list (admin/view_customer_group/{id}).
 */
class GroupController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorizeAny('customers.view');

        $groups = Group::where('company_id', $this->currentEmployee()->company_id)->withCount('customers')->orderBy('id')->get();

        return response()->json(['data' => $groups->map(fn (Group $group): array => ['id' => $group->id, 'name' => $group->name, 'customers_count' => $group->customers_count])]);
    }

    public function options(): JsonResponse
    {
        $this->authorizeAny('customers.view', 'loans.apply');

        $groups = Group::where('company_id', $this->currentEmployee()->company_id)->orderBy('name')->get(['id', 'name']);

        return response()->json(['data' => $groups->map(fn (Group $group): array => ['value' => (string) $group->id, 'label' => $group->name])]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $data = $request->validate(['group_name' => ['required', 'string', 'max:255']]);

        $group = Group::create(['company_id' => $this->currentEmployee()->company_id, 'name' => $data['group_name']]);

        return $this->message('Group Registered successfully', 201, ['data' => ['id' => $group->id]]);
    }

    public function update(Request $request, Group $group): JsonResponse
    {
        $this->authorizeAny('customers.register', 'customers.update');
        $data = $request->validate(['group_name' => ['required', 'string', 'max:255']]);

        $group->update(['name' => $data['group_name']]);

        return $this->message('Group Updated successfully');
    }

    public function destroy(Group $group): JsonResponse
    {
        $this->authorizeAny('customers.update');

        $group->delete();

        return $this->message('Group Deleted successfully');
    }

    /**
     * Customer List / {group}: loans of group members or loans taken as the group, with the live Filter (branch incl. ALL).
     */
    public function show(Request $request, Group $group): JsonResponse
    {
        $this->authorizeAny('customers.view');

        $loans = $this->applyFilters($this->scoped(Loan::query()), $request)
            ->where(fn (Builder $query) => $query
                ->where('group_id', $group->id)
                ->orWhereHas('customer', fn (Builder $customers) => $customers->where('group_id', $group->id)))
            ->with(['branch:id,name', 'customer:id,first_name,middle_name,last_name,phone,gender', 'writeOff'])
            ->withSum(['transactions as deposits_sum' => fn (Builder $transactions) => $transactions->where('type', 'deposit')], 'amount')
            ->latest('id')
            ->get();

        return response()->json([
            'group' => ['id' => $group->id, 'name' => $group->name],
            'data' => $loans->map(fn (Loan $loan): array => [
                'id' => $loan->id,
                'customer_id' => $loan->customer_id,
                'branch' => strtoupper((string) $loan->branch?->name),
                'customer_name' => $loan->customer?->full_name,
                'phone' => $loan->customer?->phone,
                'gender' => $loan->customer?->gender,
                'total_loan' => (float) $loan->total_payable,
                'paid_amount' => (float) $loan->deposits_sum,
                'remain' => max(0, (float) $loan->total_payable - (float) $loan->deposits_sum),
                'restoration' => (float) $loan->restoration,
                'write_off' => (float) ($loan->writeOff?->amount ?? 0),
                'status' => $loan->status?->label(),
                'status_badge' => $loan->status?->badge(),
            ])->values(),
        ]);
    }
}
