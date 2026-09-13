<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Hrm\Concerns\FiltersByBranchAndDate;
use App\Http\Requests\Hrm\StaffAllowanceRequest;
use App\Models\StaffAllowance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class AllowanceController extends Controller
{
    use FiltersByBranchAndDate;

    public function index(Request $request): View
    {
        $query = StaffAllowance::where('company_id', $this->currentEmployee()->company_id)->with(['branch', 'employee']);

        return view('hrm.allowances', [
            'allowances' => $this->applyBranchDateFilter($query, $request)->latest('id')->get(),
            'branches' => $this->companyBranches(),
        ]);
    }

    public function store(StaffAllowanceRequest $request): RedirectResponse
    {
        StaffAllowance::create($request->allowanceData() + ['company_id' => $this->currentEmployee()->company_id]);

        return back()->with('success', 'Allowance Saved successfully');
    }
}
