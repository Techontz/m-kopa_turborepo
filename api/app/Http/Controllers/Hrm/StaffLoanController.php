<?php

namespace App\Http\Controllers\Hrm;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Hrm\Concerns\FiltersByBranchAndDate;
use App\Http\Requests\Hrm\StaffLoanRequest;
use App\Models\StaffLoan;
use App\Models\StaffLoanCategory;
use App\Services\Ledger;
use App\Services\Payroll;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class StaffLoanController extends Controller
{
    use FiltersByBranchAndDate;

    public function index(Request $request): View
    {
        $companyId = $this->employee()->company_id;
        $base = fn () => StaffLoan::where('company_id', $companyId)->with(['branch', 'employee']);

        return view('hrm.staff-loans.index', [
            'loans' => $this->applyBranchDateFilter($base()->where('status', 'pending'), $request)->orderBy('id')->get(),
            'approved' => $this->applyBranchDateFilter($base()->whereIn('status', ['active', 'done']), $request)->latest('id')->get(),
            'categories' => StaffLoanCategory::where('company_id', $companyId)->orderBy('id')->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function store(StaffLoanRequest $request): RedirectResponse
    {
        StaffLoan::create($request->loanData() + [
            'company_id' => $this->employee()->company_id,
            'status' => 'pending',
        ]);

        return back()->with('success', 'Staff Loan Applied successfully');
    }

    /**
     * Approves the full amount applied: Loan + interest = amount × (1 + rate%),
     * restoration = total ÷ number of repayments. Disbursement (inferred) is an outflow
     * of the PRINCIPAL A/C of the employee's branch.
     */
    public function approve(StaffLoan $staffLoan, Ledger $ledger): RedirectResponse
    {
        if ($staffLoan->status !== 'pending') {
            return back()->with('error', 'Loan is not pending');
        }

        $staffLoan->loadMissing(['category', 'employee']);
        $amount = (float) $staffLoan->amount_applied;
        $total = round($amount * (1 + (float) $staffLoan->category->interest_rate / 100), 2);

        DB::transaction(function () use ($staffLoan, $ledger, $amount, $total): void {
            $staffLoan->update([
                'amount_approved' => $amount,
                'total_payable' => $total,
                'restoration' => round($total / max(1, $staffLoan->sessions), 2),
                'fee' => $staffLoan->category->fee,
                'status' => 'active',
            ]);

            $ledger->transfer($staffLoan->company_id, ['account' => Account::Principal, 'branch' => $staffLoan->employee->branch_id ?? $staffLoan->branch_id], ['account' => Account::StaffLoanReceivable, 'employee' => $staffLoan->employee_id], $amount, "Staff loan - {$staffLoan->employee->full_name}", $staffLoan);
        });

        return back()->with('success', 'Staff Loan Aproved successfully');
    }

    public function active(): View
    {
        $loans = StaffLoan::where('company_id', $this->employee()->company_id)
            ->where('status', 'active')
            ->with(['branch', 'employee', 'payments' => fn ($query) => $query->orderBy('id')])
            ->withSum('payments', 'amount')
            ->orderBy('id')
            ->get();

        return view('hrm.staff-loans.active', ['loans' => $loans]);
    }

    /**
     * Cash repayment ("Deposit"); see {@see Payroll::repay()} for the inferred ledger split.
     */
    public function pay(Request $request, StaffLoan $staffLoan, Payroll $payroll): RedirectResponse
    {
        if ($staffLoan->status !== 'active') {
            return back()->with('error', 'Loan is not active');
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:'.$staffLoan->remainingAmount()],
        ]);

        $payroll->repay($staffLoan, (float) $validated['amount']);

        return back()->with('success', 'Loan Paid successfully');
    }
}
