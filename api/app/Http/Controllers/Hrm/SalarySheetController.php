<?php

namespace App\Http\Controllers\Hrm;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Models\SalaryPayment;
use App\Services\Payroll;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class SalarySheetController extends Controller
{
    /**
     * Current month's sheet. Columns (inferred from live figures):
     * Sallary Advance = approved staff salary advances not yet deducted,
     * Allowance = active allowances, Deduction = active deduction instalments,
     * Loan Restration = restoration of active staff loans,
     * Take Home = Salary + Allowance − Advance − Deduction − Loan Restration.
     */
    public function index(Request $request, Payroll $payroll): View
    {
        $companyId = $this->currentEmployee()->company_id;

        $payments = SalaryPayment::where('company_id', $companyId)
            ->with('employee')
            ->when($request->date('from'), fn ($query, $from) => $query->whereDate('paid_on', '>=', $from->toDateString()))
            ->when($request->date('to'), fn ($query, $to) => $query->whereDate('paid_on', '<=', $to->toDateString()))
            ->latest('id')
            ->get();

        return view('hrm.salary-sheet', [
            'rows' => $payroll->sheet($companyId),
            'payments' => $payments,
        ]);
    }

    /**
     * "Pay" modal: pays every employee with salary information from the branch INTEREST account.
     * See {@see Payroll::pay()} for the inferred ledger effects.
     */
    public function pay(Request $request, Payroll $payroll): RedirectResponse
    {
        $request->validate(['ac_id' => ['required', Rule::in([Account::Interest->value])]]);

        $paid = $payroll->pay($this->currentEmployee()->company_id, Account::Interest);

        if ($paid === 0) {
            return back()->with('error', 'No staff with salary information to pay');
        }

        return back()->with('success', 'Salary Paid successfully');
    }
}
