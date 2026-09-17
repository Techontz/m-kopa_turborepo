<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Models\Customer;
use App\Models\Loan;
use App\Services\LoanService;
use App\Services\PaymentService;
use App\Services\Reports\DailyReport;
use App\Services\Reports\OperationalReports;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The live system's "Report" tab: Cash Transaction, Branch Wise Report, File, Loan Pending, Loan Repayment, Default Loan,
 * Write-off Loan, Loan Collection, Customer statement, Today Receivable, Today Received, Daily Report, Customer Development.
 * Every endpoint requires reports.view and is limited to the employee's branch scope.
 */
class LiveReportController extends ReportApiController
{
    public function __construct(private readonly OperationalReports $reports) {}

    public function cash(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $scope = $this->reportScope($request, defaultToToday: true);

        return $this->report($this->reports->cash($scope) + ['filter' => $this->filterEcho($request, $scope)]);
    }

    public function branchwise(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $scope = $this->reportScope($request);

        return $this->report($this->reports->branchwise($scope) + ['filter' => $this->filterEcho($request, $scope)]);
    }

    public function file(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $request->validate(['loan_status' => ['nullable', 'in:ALL,ACTIVE,CLOSED,DEFAULT'], 'year' => ['nullable', 'integer', 'between:2000,2100']]);
        $scope = $this->reportScope($request);
        $year = $request->integer('year') ?: (int) now()->format('Y');

        return $this->report($this->reports->file($scope, $year, $request->string('loan_status')->toString() ?: null) + ['year' => $year, 'years' => $this->years()]);
    }

    public function newLoans(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $request->validate(['year' => ['nullable', 'integer', 'between:2000,2100']]);
        $year = $request->integer('year') ?: (int) now()->format('Y');

        return $this->report($this->reports->newLoans($this->reportScope($request), $year) + ['year' => $year, 'years' => $this->years()]);
    }

    public function pending(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');

        return $this->report($this->reports->pending($this->reportScope($request), CarbonImmutable::today()));
    }

    public function repayment(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');

        return $this->report($this->reports->repayment($this->reportScope($request)));
    }

    public function default(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');

        return $this->report($this->reports->default($this->reportScope($request), CarbonImmutable::today()));
    }

    /**
     * Write-off Loan (`done=0`) and Bad Debt Done (`done=1`).
     */
    public function writeOff(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');

        return $this->report($this->reports->writeOff($this->reportScope($request), $request->boolean('done')));
    }

    public function collection(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $request->validate(['loan_status' => ['nullable', 'in:PENDING,APROVED,DISBURSED,ACTIVE,DONE,DEFALT']]);

        return $this->report($this->reports->collection($this->reportScope($request), $request->string('loan_status')->toString() ?: null));
    }

    /**
     * Customer statement: the Payments module statement (Principal / Penalty / Interest / Insurance split per repayment,
     * running remaining debit, receipt) for one customer, optionally one loan, with the loan header of the live page.
     */
    public function statement(Request $request, PaymentService $payments, LoanService $loans): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $request->validate([
            'customer_id' => ['nullable', 'integer'],
            'loan_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        if (! $request->filled('customer_id')) {
            return $this->report(['customer' => null, 'loans' => [], 'loan' => null, 'rows' => [], 'totals' => (object) []]);
        }

        $customer = Customer::where('company_id', $this->currentEmployee()->company_id)->findOrFail($request->integer('customer_id'));
        $this->assertBranchAccessible((int) $customer->branch_id);

        $customerLoans = $customer->loans()->with(['category:id,name', 'branch:id,name'])->latest('id')->get();
        $loan = $request->filled('loan_id') ? $customerLoans->firstWhere('id', $request->integer('loan_id')) : null;
        abort_if($request->filled('loan_id') && $loan === null, 404);

        $rows = $payments->statement($customer, $request->input('from'), $request->input('to'))
            ->when($loan, fn ($collection) => $collection->where('loan_id', $loan->id))
            ->values();

        $paid = 0.0;
        $rows = $rows->map(function (array $row) use (&$paid): array {
            $paid += $row['deposit'];

            return $row + ['balance' => round($paid, 2)];
        });

        return $this->report([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->full_name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'branch' => $customer->branch?->name,
            ],
            'loans' => $customerLoans->map(fn (Loan $option): array => [
                'value' => (string) $option->id,
                'label' => trim(($option->category?->name ?? 'LOAN').' / '.money($option->amount_approved > 0 ? $option->amount_approved : $option->amount_applied).' / '.$option->status->label()),
            ])->values()->all(),
            'loan' => $loan ? [
                'id' => $loan->id,
                'loan_number' => $loan->loan_number,
                'reference_number' => $loan->reference_number,
                'product' => $loan->category?->name,
                'branch' => $loan->branch?->name,
                'amount' => (float) ($loan->amount_approved > 0 ? $loan->amount_approved : $loan->amount_applied),
                'total_payable' => (float) $loan->total_payable,
                'duration' => $loan->duration->label(),
                'sessions' => $loan->sessions,
                'restoration' => (float) $loan->restoration,
                'withdrawal_date' => $loan->withdrawn_at?->toDateString(),
                'end_date' => $loan->end_date?->toDateString(),
                'status' => $loan->status->label(),
                'outstanding' => $loans->outstanding($loan),
            ] : null,
            'rows' => $rows->all(),
            'totals' => collect(['deposit', 'withdrawal', 'principal', 'penalty', 'interest', 'insurance'])
                ->mapWithKeys(fn (string $column): array => [$column => round((float) $rows->sum($column), 2)])
                ->all(),
        ]);
    }

    public function receivable(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $request->validate(['paid_status' => ['nullable', 'in:paid,not paid,all']]);
        $scope = $this->reportScope($request, defaultToToday: true);
        $status = $request->string('paid_status')->toString();

        return $this->report($this->reports->receivable($scope, in_array($status, ['paid', 'not paid'], true) ? $status : null) + ['filter' => $this->filterEcho($request, $scope)]);
    }

    /**
     * Today by default; a chosen branch shows its whole history (unless dates are given too).
     */
    public function received(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $scope = $this->reportScope($request, defaultToToday: ! is_numeric($request->input('branch_id')));

        return $this->report($this->reports->received($scope) + ['filter' => $this->filterEcho($request, $scope)]);
    }

    public function daily(Request $request, DailyReport $daily): JsonResponse
    {
        $this->authorizeAny('reports.view');
        $scope = $this->reportScope($request, defaultToToday: true);
        $from = $scope->from ?? $scope->to ?? CarbonImmutable::today();
        $to = $scope->to ?? $from;

        return $this->report($daily->forScope($scope, $from, $to) + [
            'filter' => $this->filterEcho($request, $scope),
            'heading' => $from->equalTo($to) ? $from->format('F, d, Y') : $from->format('F, d, Y').' - '.$to->format('F, d, Y'),
        ]);
    }

    public function development(Request $request): JsonResponse
    {
        $this->authorizeAny('reports.view');

        return $this->report($this->reports->markedCustomers($this->reportScope($request)));
    }

    public function developmentShow(Customer $customer): JsonResponse
    {
        $this->authorizeAny('reports.view');
        abort_unless($this->scoped(Customer::query())->whereKey($customer->id)->exists(), 404);

        return $this->report($this->reports->development($customer));
    }

    /**
     * Years offered by the File filter: the current year back to the first loan cash-out (live: 2026 … 2023).
     *
     * @return list<int>
     */
    private function years(): array
    {
        $first = Loan::where('company_id', $this->currentEmployee()->company_id)->whereNotNull('withdrawn_at')->min('withdrawn_at');
        $current = (int) now()->format('Y');
        $start = $first ? min($current, (int) substr((string) $first, 0, 4)) : $current;

        return range($current, $start);
    }

    /**
     * @param  array<string|int, mixed>  $data
     */
    private function report(array $data): JsonResponse
    {
        return response()->json(['data' => $data]);
    }
}
