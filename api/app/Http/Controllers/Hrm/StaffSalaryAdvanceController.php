<?php

namespace App\Http\Controllers\Hrm;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Hrm\Concerns\FiltersByBranchAndDate;
use App\Http\Requests\Hrm\StaffSalaryAdvanceRequest;
use App\Models\StaffSalaryAdvance;
use App\Models\StaffSalaryAdvanceCategory;
use App\Services\Ledger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class StaffSalaryAdvanceController extends Controller
{
    use FiltersByBranchAndDate;

    public function index(Request $request): View
    {
        $companyId = $this->employee()->company_id;
        $base = fn () => StaffSalaryAdvance::where('company_id', $companyId)->with(['branch', 'employee']);

        return view('hrm.salary-advances', [
            'advances' => $this->applyBranchDateFilter($base()->where('status', 'pending'), $request)->orderBy('id')->get(),
            'approved' => $this->applyBranchDateFilter($base()->whereIn('status', ['approved', 'done']), $request)->latest('id')->get(),
            'categories' => StaffSalaryAdvanceCategory::where('company_id', $companyId)->orderBy('id')->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function store(StaffSalaryAdvanceRequest $request): RedirectResponse
    {
        $category = $request->category();

        StaffSalaryAdvance::create([
            'company_id' => $this->employee()->company_id,
            'branch_id' => $request->integer('blanch_id'),
            'employee_id' => $request->integer('empl_id'),
            'staff_salary_advance_category_id' => $category->id,
            'amount' => (float) $request->input('advance_amount'),
            'fee' => $category->fee,
            'status' => 'pending',
        ]);

        return back()->with('success', 'Salary Advance Requested successfully');
    }

    /**
     * Inferred: the advance is paid out of the branch INTEREST account (the account salaries are
     * paid from) and is later subtracted from the take home on the salary sheet.
     */
    public function approve(StaffSalaryAdvance $staffSalaryAdvance, Ledger $ledger): RedirectResponse
    {
        if ($staffSalaryAdvance->status !== 'pending') {
            return back()->with('error', 'Salary advance is not pending');
        }

        DB::transaction(function () use ($staffSalaryAdvance, $ledger): void {
            $staffSalaryAdvance->update(['status' => 'approved']);
            $branchId = $staffSalaryAdvance->employee->branch_id ?? $staffSalaryAdvance->branch_id;
            $ledger->transfer($staffSalaryAdvance->company_id, ['account' => Account::Interest, 'branch' => $branchId], ['account' => Account::StaffAdvanceReceivable, 'employee' => $staffSalaryAdvance->employee_id], (float) $staffSalaryAdvance->amount, 'Staff salary advance', $staffSalaryAdvance);
        });

        return back()->with('success', 'Salary Advance Aproved successfully');
    }

    public function reject(StaffSalaryAdvance $staffSalaryAdvance): RedirectResponse
    {
        if ($staffSalaryAdvance->status !== 'pending') {
            return back()->with('error', 'Salary advance is not pending');
        }

        $staffSalaryAdvance->update(['status' => 'rejected']);

        return back()->with('success', 'Salary Advance Rejected successfully');
    }
}
