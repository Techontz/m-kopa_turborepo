<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Loan;
use App\Services\Reports\DailyReport;
use App\Services\Reports\LoanReports;
use App\Services\Reports\ReportFilter;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ReportController extends Controller
{
    public function __construct(private readonly LoanReports $reports) {}

    public function cash(Request $request): View
    {
        return view('reports.cash', [
            'transactions' => $this->reports->cashTransactions($this->filter($request)),
            'branches' => $this->branches(),
        ]);
    }

    public function branchwise(Request $request): View
    {
        return view('reports.branchwise', [
            'rows' => $this->reports->branchSummary($this->filter($request, defaultToToday: false)),
            'branches' => $this->branches(),
        ]);
    }

    public function file(Request $request): View
    {
        $year = $this->year($request);
        $status = $request->string('loan_status')->toString() ?: null;

        return view('reports.file', $this->reports->fileReport($this->company(), $year, $this->filter($request)->branchId, $status) + [
            'year' => $year,
            'years' => $this->years(),
            'branches' => $this->branches(),
        ]);
    }

    public function newLoans(Request $request): View
    {
        $year = $this->year($request);

        return view('reports.new-loans', [
            'loans' => $this->reports->newLoans($this->company(), $year, $this->filter($request)->branchId),
            'year' => $year,
            'branches' => $this->branches(),
        ]);
    }

    public function pending(Request $request): View
    {
        return view('reports.pending', [
            'rows' => $this->reports->pendingLoans($this->company(), $this->filter($request)->branchId, CarbonImmutable::today()),
            'branches' => $this->branches(),
        ]);
    }

    public function repayment(Request $request): View
    {
        return view('reports.repayment', [
            'loans' => $this->reports->repayments($this->company(), $this->filter($request)->branchId),
            'branches' => $this->branches(),
        ]);
    }

    public function default(Request $request): View
    {
        return view('reports.default', [
            'loans' => $this->reports->defaultLoans($this->company(), $this->filter($request)->branchId, CarbonImmutable::today()),
            'branches' => $this->branches(),
        ]);
    }

    public function writeOff(Request $request): View
    {
        return view('reports.write-off', [
            'writeOffs' => $this->reports->writeOffs($this->company(), $this->filter($request)->branchId),
            'branches' => $this->branches(),
        ]);
    }

    public function writeOffDone(Request $request): View
    {
        return view('reports.write-off-done', [
            'writeOffs' => $this->reports->writeOffs($this->company(), $this->filter($request)->branchId, recovered: true),
            'branches' => $this->branches(),
        ]);
    }

    public function collection(Request $request): View
    {
        return view('reports.collection', [
            'loans' => $this->reports->collection($this->company(), $this->filter($request)->branchId, $request->string('loan_status')->toString() ?: null),
            'branches' => $this->branches(),
        ]);
    }

    public function statement(Request $request): View
    {
        $companyId = $this->employee()->company_id;
        $customer = null;
        $loan = null;

        if ($request->filled('customer_id')) {
            $customer = Customer::where('company_id', $companyId)->findOrFail($request->integer('customer_id'));
        }

        if ($customer && $request->filled('loan_id')) {
            $loan = $customer->loans()->with(['branch', 'category'])->findOrFail($request->integer('loan_id'));
        }

        return view('reports.statement', [
            'customers' => Customer::where('company_id', $companyId)->orderByDesc('id')->get(),
            'customer' => $customer,
            'customerLoans' => $customer?->loans()->with('category')->latest('id')->get() ?? collect(),
            'loan' => $loan,
            'rows' => $loan ? $this->reports->statement($loan) : collect(),
        ]);
    }

    public function receivable(Request $request): View
    {
        $paidStatus = $request->string('paid_status')->toString();

        return view('reports.receivable', [
            'schedules' => $this->reports->receivable($this->filter($request), in_array($paidStatus, ['paid', 'not paid'], true) ? $paidStatus : null),
            'branches' => $this->branches(),
        ]);
    }

    public function received(Request $request): View
    {
        return view('reports.received', [
            'transactions' => $this->reports->received($this->filter($request)),
            'branches' => $this->branches(),
        ]);
    }

    public function daily(Request $request, DailyReport $dailyReport): View
    {
        $filter = $this->filter($request);

        return view('reports.daily', [
            'report' => $dailyReport->build($filter),
            'filter' => $filter,
            'branches' => $this->branches(),
        ]);
    }

    public function development(): View
    {
        return view('reports.development', [
            'customers' => Customer::where('company_id', $this->employee()->company_id)
                ->where('is_marked', true)
                ->with('branch')
                ->orderBy('id')
                ->get(),
        ]);
    }

    public function developmentShow(Customer $customer): View
    {
        return view('reports.development-show', $this->reports->development($customer) + [
            'customer' => $customer,
        ]);
    }

    private function filter(Request $request, bool $defaultToToday = true): ReportFilter
    {
        return ReportFilter::fromRequest($request, $this->company(), $defaultToToday);
    }

    private function year(Request $request): int
    {
        $year = $request->integer('year');

        return $year >= 2000 && $year <= 2100 ? $year : (int) now()->format('Y');
    }

    /**
     * Years offered by the File filter: the current year back to the first loan cash-out (live: 2026 … 2023).
     *
     * @return list<int>
     */
    private function years(): array
    {
        $first = Loan::where('company_id', $this->employee()->company_id)->whereNotNull('withdrawn_at')->min('withdrawn_at');
        $current = (int) now()->format('Y');
        $start = $first ? min($current, (int) substr((string) $first, 0, 4)) : $current;

        return range($current, $start);
    }
}
