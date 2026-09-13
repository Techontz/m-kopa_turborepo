<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\BranchRequest;
use App\Models\Branch;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class BranchController extends Controller
{
    public function index(): View
    {
        $branches = Branch::where('company_id', $this->currentEmployee()->company_id)
            ->with('region')
            ->withCount([
                'customers as active_count' => fn ($query) => $query->where('status', 'open'),
                'customers as pending_count' => fn ($query) => $query->where('status', 'pending'),
                'customers as default_count' => fn ($query) => $query->where('status', 'out'),
                'customers as done_count' => fn ($query) => $query->where('status', 'close'),
                'customers as all_count',
            ])
            ->orderBy('id')
            ->get();

        return view('settings.branches', [
            'branches' => $branches,
            'regions' => Region::orderBy('id')->get(),
        ]);
    }

    public function store(BranchRequest $request): RedirectResponse
    {
        Branch::create($request->branchData() + ['company_id' => $this->currentEmployee()->company_id]);

        return back()->with('success', 'Branch Registered successfully');
    }

    public function update(BranchRequest $request, Branch $branch): RedirectResponse
    {
        $branch->update($request->branchData());

        return back()->with('success', 'Branch Updated successfully');
    }

    public function destroy(Branch $branch): RedirectResponse
    {
        if ($branch->customers()->exists() || $branch->employees()->exists()) {
            return back()->with('error', 'Branch has customers or staff and cannot be deleted');
        }

        $branch->delete();

        return back()->with('success', 'Branch Deleted successfully');
    }
}
