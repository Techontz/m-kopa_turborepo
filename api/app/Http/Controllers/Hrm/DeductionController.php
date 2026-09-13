<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Hrm\Concerns\FiltersByBranchAndDate;
use App\Http\Requests\Hrm\StaffDeductionRequest;
use App\Models\StaffDeduction;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DeductionController extends Controller
{
    use FiltersByBranchAndDate;

    public function index(Request $request): View
    {
        $query = StaffDeduction::where('company_id', $this->currentEmployee()->company_id)->with(['branch', 'employee']);

        return view('hrm.deductions', [
            'deductions' => $this->applyBranchDateFilter($query, $request)->latest('id')->get(),
            'branches' => $this->companyBranches(),
        ]);
    }

    public function store(StaffDeductionRequest $request): RedirectResponse
    {
        StaffDeduction::create($request->deductionData() + ['company_id' => $this->currentEmployee()->company_id]);

        return back()->with('success', 'Deduction Saved successfully');
    }
}
