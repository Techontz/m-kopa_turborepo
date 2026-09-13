<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\Loan;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class GroupController extends Controller
{
    public function index(): View
    {
        return view('groups.index', [
            'groups' => Group::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['group_name' => ['required', 'string', 'max:255']]);

        Group::create(['company_id' => $this->employee()->company_id, 'name' => $data['group_name']]);

        return back()->with('success', 'Group Registered successfully');
    }

    public function update(Request $request, Group $group): RedirectResponse
    {
        $data = $request->validate(['group_name' => ['required', 'string', 'max:255']]);

        $group->update(['name' => $data['group_name']]);

        return back()->with('success', 'Group Updated successfully');
    }

    public function destroy(Group $group): RedirectResponse
    {
        $group->delete();

        return back()->with('success', 'Group Deleted successfully');
    }

    public function show(Request $request, Group $group): View
    {
        $branchId = $request->filled('blanch_id') && $request->input('blanch_id') !== 'all' ? $request->integer('blanch_id') : null;

        $loans = Loan::query()
            ->where('company_id', $this->employee()->company_id)
            ->where(fn (Builder $query) => $query
                ->where('group_id', $group->id)
                ->orWhereHas('customer', fn (Builder $customers) => $customers->where('group_id', $group->id)))
            ->when($branchId, fn (Builder $query, int $id) => $query->where('branch_id', $id))
            ->with(['branch', 'customer', 'writeOff'])
            ->withSum(['transactions as deposits_sum' => fn (Builder $transactions) => $transactions->where('type', 'deposit')], 'amount')
            ->latest('id')
            ->get();

        return view('groups.show', [
            'group' => $group,
            'loans' => $loans,
            'branches' => $this->branches(),
        ]);
    }
}
