<?php

namespace App\Http\Controllers\Bank;

use App\Http\Controllers\Controller;
use App\Models\SalaryPayment;
use Illuminate\Support\Carbon;
use Illuminate\View\View;

/**
 * Read-only views over salary payments recorded by the HRM salary sheet.
 */
class PayrollController extends Controller
{
    public function index(): View
    {
        $payrolls = SalaryPayment::where('company_id', $this->employee()->company_id)
            ->selectRaw('paid_on, MAX(paid_from_account) as paid_from_account, SUM(take_home) as total')
            ->groupBy('paid_on')
            ->orderByDesc('paid_on')
            ->get();

        return view('bank.payroll', ['payrolls' => $payrolls]);
    }

    public function show(string $date): View
    {
        abort_unless(preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) === 1, 404);

        $paidOn = Carbon::parse($date);

        $payments = SalaryPayment::where('company_id', $this->employee()->company_id)
            ->whereDate('paid_on', $paidOn->toDateString())
            ->with('employee')
            ->orderBy('id')
            ->get();

        return view('bank.payroll-show', [
            'date' => $paidOn->toDateString(),
            'payments' => $payments,
        ]);
    }
}
