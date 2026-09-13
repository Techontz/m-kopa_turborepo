<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Hrm\LeaveRequest;
use App\Models\Employee;
use App\Models\Leave;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class LeaveController extends Controller
{
    public function index(): View
    {
        $companyId = $this->employee()->company_id;

        return view('hrm.leaves', [
            'leaves' => Leave::where('company_id', $companyId)->with('employee.branch')->latest('id')->get(),
            'employees' => Employee::where('company_id', $companyId)->where('status', 'active')->orderByDesc('id')->get(),
        ]);
    }

    public function store(LeaveRequest $request): RedirectResponse
    {
        Leave::create($request->leaveData() + ['company_id' => $this->employee()->company_id]);

        return back()->with('success', 'Leave Saved successfully');
    }
}
