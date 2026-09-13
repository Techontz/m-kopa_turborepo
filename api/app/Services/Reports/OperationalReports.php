<?php

namespace App\Services\Reports;

use App\Enums\LoanStatus;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanSchedule;
use App\Models\LoanTransaction;
use App\Models\WriteOff;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Data behind the live "Report" tab pages (API version of LoanReports, scoped to the employee's branches).
 *
 * "Loan Amount" on the live reports is principal + interest (e.g. 260,000 over 4 × 65,000). Outstanding figures come
 * from {@see LoanBalances} (same numbers as LoanService::outstanding(), allocation Principal → Penalty → Interest):
 * "Remain Amount" is the whole outstanding balance, except on pages that show the penalty in its own column
 * (Loan Collection, Customer Development) where it is the loan debt without penalty.
 */
class OperationalReports
{
    /**
     * Cash Transaction: loan deposits and withdrawals in the date range.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array{deposit: float, withdrawal: float}}
     */
    public function cash(ReportScope $scope): array
    {
        $rows = $scope->between($scope->apply(LoanTransaction::query(), 'loan_transactions'), 'transaction_date')
            ->with('customer:id,first_name,middle_name,last_name')
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get()
            ->map(fn (LoanTransaction $transaction): array => [
                'id' => $transaction->id,
                'loan_id' => $transaction->loan_id,
                'customer_id' => $transaction->customer_id,
                'customer' => $transaction->customer?->full_name,
                'deposit' => $transaction->type === 'deposit' ? (float) $transaction->amount : null,
                'withdrawal' => $transaction->type === 'withdrawal' ? (float) $transaction->amount : null,
                'date' => $transaction->transaction_date->toDateString(),
            ]);

        return [
            'rows' => $rows->values()->all(),
            'totals' => ['deposit' => round((float) $rows->sum('deposit'), 2), 'withdrawal' => round((float) $rows->sum('withdrawal'), 2)],
        ];
    }

    /**
     * Branchwise Loan Summary. Without dates the totals cover the whole loan book (receivable = principal + interest of
     * every cashed-out loan, received = every repayment). With dates: receivable = instalments due in the range split
     * in the loan's principal:interest proportion (inferred), received = repayments in the range.
     * Total Pending = receivable − received excluding the penalty part (penalties are not part of the receivable).
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function branchwise(ReportScope $scope): array
    {
        $statuses = LoanStatus::values(...LoanStatus::disbursed());

        if ($scope->dated()) {
            $receivable = $scope->between($scope->apply(LoanSchedule::query()->join('loans', 'loans.id', '=', 'loan_schedules.loan_id'), 'loans'), 'loan_schedules.due_date')
                ->whereIn('loans.status', $statuses)
                ->groupBy('loans.branch_id')
                ->selectRaw('loans.branch_id as branch_id, SUM(loan_schedules.amount) as total')
                ->selectRaw('SUM(CASE WHEN loans.total_payable + loans.insurance > 0 THEN loan_schedules.amount * loans.amount_approved / (loans.total_payable + loans.insurance) ELSE 0 END) as principal')
                ->selectRaw('SUM(CASE WHEN loans.total_payable + loans.insurance > 0 THEN loan_schedules.amount * loans.interest_amount / (loans.total_payable + loans.insurance) ELSE 0 END) as interest')
                ->get()
                ->keyBy('branch_id');
        } else {
            $receivable = $scope->apply(Loan::query(), 'loans')
                ->whereIn('status', $statuses)
                ->groupBy('branch_id')
                ->selectRaw('branch_id, SUM(total_payable) as total, SUM(amount_approved) as principal, SUM(interest_amount) as interest')
                ->get()
                ->keyBy('branch_id');
        }

        $received = $scope->between($scope->apply(LoanTransaction::query(), 'loan_transactions'), 'transaction_date')
            ->where('type', 'deposit')
            ->groupBy('branch_id')
            ->selectRaw('branch_id, SUM(amount) as total, SUM(principal) as principal, SUM(interest) as interest, SUM(penalty) as penalty, SUM(reserve) as reserve')
            ->get()
            ->keyBy('branch_id');

        $rows = $scope->apply(Branch::query(), 'branches', 'id')
            ->orderBy('id')
            ->get()
            ->map(function (Branch $branch) use ($receivable, $received): array {
                $due = $receivable->get($branch->id);
                $paid = $received->get($branch->id);
                $total = round((float) ($due->total ?? 0), 2);
                $receivedTotal = round((float) ($paid->total ?? 0), 2);

                return [
                    'branch_id' => $branch->id,
                    'branch' => $branch->name,
                    'receivable' => $total,
                    'receivable_principal' => round((float) ($due->principal ?? 0), 2),
                    'receivable_interest' => round((float) ($due->interest ?? 0), 2),
                    'received' => $receivedTotal,
                    'received_principal' => round((float) ($paid->principal ?? 0), 2),
                    'received_interest' => round((float) ($paid->interest ?? 0), 2),
                    'pending' => round(max(0.0, $total - ($receivedTotal - (float) ($paid->penalty ?? 0))), 2),
                    'reserve' => round((float) ($paid->reserve ?? 0), 2),
                ];
            });

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['receivable', 'receivable_principal', 'receivable_interest', 'received', 'received_principal', 'received_interest', 'pending', 'reserve'])];
    }

    /**
     * "File": loans with collections in the year and one column per month that had collections.
     *
     * @return array{rows: list<array<string, mixed>>, months: list<array{number: int, name: string}>, totals: array<string, float>}
     */
    public function file(ReportScope $scope, int $year, ?string $status): array
    {
        $statusValue = match ($status) {
            'ACTIVE' => [LoanStatus::Active, LoanStatus::Overdue],
            'CLOSED' => [LoanStatus::Closed],
            'DEFAULT' => [LoanStatus::Default],
            default => null,
        };

        $deposits = $scope->apply(LoanTransaction::query(), 'loan_transactions')
            ->where('type', 'deposit')
            ->whereNotNull('loan_id')
            ->whereBetween('transaction_date', ["{$year}-01-01", "{$year}-12-31"])
            ->when($statusValue, fn (Builder $query, array $values) => $query->whereHas('loan', fn (Builder $loan) => $loan->whereIn('status', LoanStatus::values(...$values))))
            ->get(['loan_id', 'amount', 'transaction_date']);

        $monthly = [];
        foreach ($deposits as $deposit) {
            $month = (int) $deposit->transaction_date->format('n');
            $monthly[$deposit->loan_id][$month] = round(($monthly[$deposit->loan_id][$month] ?? 0) + (float) $deposit->amount, 2);
        }
        $monthNumbers = $deposits->map(fn (LoanTransaction $deposit): int => (int) $deposit->transaction_date->format('n'))->unique()->sort()->values();

        $rows = $this->loanRows($this->loans($scope)->whereIn('loans.id', array_keys($monthly) ?: [0]))
            ->map(fn (array $row): array => $row + ['months' => (object) ($monthly[$row['id']] ?? [])]);

        $totals = $this->sums($rows, ['total_payable', 'restoration', 'paid', 'remain']);
        foreach ($monthNumbers as $month) {
            $totals["month_{$month}"] = round(collect($monthly)->sum(fn (array $amounts): float => $amounts[$month] ?? 0), 2);
        }

        return [
            'rows' => $rows->values()->all(),
            'months' => $monthNumbers->map(fn (int $month): array => ['number' => $month, 'name' => CarbonImmutable::create($year, $month, 1)->format('F')])->all(),
            'totals' => $totals,
        ];
    }

    /**
     * "FILE REPORT NEW LOAN": loans cashed out in the year.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function newLoans(ReportScope $scope, int $year): array
    {
        $rows = $this->loanRows($this->loans($scope)->whereBetween('loans.withdrawn_at', ["{$year}-01-01", "{$year}-12-31"])->reorder('loans.withdrawn_at'));

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['total_payable', 'restoration', 'paid', 'remain'])];
    }

    /**
     * Loan Pending: active / overdue loans with instalments that fell due before today and are not fully paid.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array{pending: float}}
     */
    public function pending(ReportScope $scope, CarbonImmutable $today): array
    {
        $arrears = LoanSchedule::query()
            ->whereDate('due_date', '<', $today->toDateString())
            ->whereColumn('paid_amount', '<', 'amount')
            ->groupBy('loan_id')
            ->selectRaw('loan_id, SUM(amount - paid_amount) as pending, MIN(due_date) as oldest_due');

        $rows = $this->loanRows(
            $this->loans($scope, [LoanStatus::Active, LoanStatus::Overdue])
                ->joinSub($arrears, 'arrears', 'arrears.loan_id', '=', 'loans.id')
                ->addSelect(['arrears.pending', 'arrears.oldest_due'])
                ->reorder('arrears.oldest_due'),
            fn (Loan $loan): array => ['pending' => round((float) $loan->pending, 2), 'date' => substr((string) $loan->oldest_due, 0, 10)],
        );

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['pending'])];
    }

    /**
     * Loan Repayment: the loan book still being repaid (active, overdue and default loans; inferred).
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function repayment(ReportScope $scope): array
    {
        $rows = $this->loanRows($this->loans($scope, LoanStatus::repayable())->reorder('loans.withdrawn_at'));

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['amount_approved', 'interest_amount', 'total_payable', 'remain'])];
    }

    /**
     * Default Loan: loans in DEFAULT with this month's repayments and the remaining balance.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function default(ReportScope $scope, CarbonImmutable $today): array
    {
        $thisMonth = LoanTransaction::query()
            ->where('type', 'deposit')
            ->whereBetween('transaction_date', [$today->startOfMonth()->toDateString(), $today->endOfMonth()->toDateString()])
            ->groupBy('loan_id')
            ->selectRaw('loan_id, SUM(amount) as amount');

        $rows = $this->loanRows(
            $this->loans($scope, [LoanStatus::Default])
                ->leftJoinSub($thisMonth, 'this_month', 'this_month.loan_id', '=', 'loans.id')
                ->addSelect(DB::raw('COALESCE(this_month.amount, 0) as paid_this_month'))
                ->reorder('loans.withdrawn_at'),
            fn (Loan $loan): array => ['paid_this_month' => round((float) $loan->paid_this_month, 2)],
        );

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['paid_this_month', 'remain'])];
    }

    /**
     * Write-off Loan (open write-offs) / Bad Debt Done (written-off debt fully recovered; inferred).
     *
     * @return array{rows: list<array<string, mixed>>, totals: array{amount: float, recovered_amount: float}}
     */
    public function writeOff(ReportScope $scope, bool $recovered): array
    {
        $rows = WriteOff::query()
            ->whereHas('loan', fn (Builder $query) => $scope->apply($query, 'loans'))
            ->when($recovered, fn (Builder $query) => $query->whereColumn('recovered_amount', '>=', 'amount'), fn (Builder $query) => $query->whereColumn('recovered_amount', '<', 'amount'))
            ->when($scope->dated(), fn (Builder $query) => $scope->between($query, 'written_off_on'))
            ->with(['loan.customer:id,first_name,middle_name,last_name,phone', 'loan.branch:id,name', 'employee:id,first_name,middle_name,last_name'])
            ->orderBy('written_off_on')
            ->get()
            ->map(fn (WriteOff $writeOff): array => [
                'id' => $writeOff->id,
                'loan_id' => $writeOff->loan_id,
                'branch' => $writeOff->loan->branch?->name,
                'customer_id' => $writeOff->loan->customer_id,
                'customer' => $writeOff->loan->customer?->full_name,
                'phone' => $writeOff->loan->customer?->phone,
                'total_payable' => (float) $writeOff->loan->total_payable,
                'restoration' => (float) $writeOff->loan->restoration,
                'duration' => $writeOff->loan->duration->label(),
                'sessions' => $writeOff->loan->sessions,
                'amount' => (float) $writeOff->amount,
                'recovered_amount' => (float) $writeOff->recovered_amount,
                'start_date' => $writeOff->loan->withdrawn_at?->toDateString(),
                'end_date' => $writeOff->loan->end_date?->toDateString(),
                'written_off_on' => $writeOff->written_off_on?->toDateString(),
                'employee' => $writeOff->employee?->full_name,
                'description' => $writeOff->description,
            ]);

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['amount', 'recovered_amount'])];
    }

    /**
     * Loan Collection filtered by the live status options. Without a status every cashed-out loan is listed.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function collection(ReportScope $scope, ?string $status): array
    {
        $statuses = match ($status) {
            'PENDING' => [LoanStatus::PendingManagerApproval, LoanStatus::Returned, LoanStatus::MandatePendingOtp, LoanStatus::MandateFailed, LoanStatus::PendingCreditReview],
            'APROVED' => [LoanStatus::PendingFinance],
            'DISBURSED' => [LoanStatus::AwaitingDisbursement, LoanStatus::DisbursementFailed, LoanStatus::Escalated, LoanStatus::DisbursementSuspense],
            'ACTIVE' => [LoanStatus::Active, LoanStatus::Overdue],
            'DONE' => [LoanStatus::Closed],
            'DEFALT' => [LoanStatus::Default],
            default => [LoanStatus::Active, LoanStatus::Overdue, LoanStatus::Default, LoanStatus::Closed],
        };

        $rows = $this->loanRows($this->loans($scope, $statuses), fn (Loan $loan): array => [
            'remain' => round((float) $loan->out_total - (float) $loan->out_penalty, 2),
        ]);

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['total_payable', 'paid', 'remain', 'penalty'])];
    }

    /**
     * Today Receivable: instalments due in the range with their paid status.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function receivable(ReportScope $scope, ?string $paidStatus): array
    {
        $rows = $scope->between(LoanSchedule::query()->join('loans', 'loans.id', '=', 'loan_schedules.loan_id'), 'loan_schedules.due_date')
            ->tap(fn (Builder $query) => $scope->apply($query, 'loans'))
            ->whereIn('loans.status', LoanStatus::values(LoanStatus::Active, LoanStatus::Overdue, LoanStatus::Default, LoanStatus::Closed))
            ->when($paidStatus === 'paid', fn (Builder $query) => $query->whereColumn('loan_schedules.paid_amount', '>=', 'loan_schedules.amount'))
            ->when($paidStatus === 'not paid', fn (Builder $query) => $query->whereColumn('loan_schedules.paid_amount', '<', 'loan_schedules.amount'))
            ->select('loan_schedules.*')
            ->with(['loan.customer:id,first_name,middle_name,last_name,phone', 'loan.branch:id,name', 'loan.employee:id,first_name,middle_name,last_name'])
            ->orderBy('loan_schedules.due_date')
            ->orderBy('loan_schedules.id')
            ->get()
            ->map(fn (LoanSchedule $schedule): array => [
                'id' => $schedule->id,
                'loan_id' => $schedule->loan_id,
                'customer_id' => $schedule->loan->customer_id,
                'customer' => $schedule->loan->customer?->full_name,
                'branch' => $schedule->loan->branch?->name,
                'phone' => $schedule->loan->customer?->phone,
                'duration' => $schedule->loan->duration->label(),
                'total_payable' => (float) $schedule->loan->total_payable,
                'restoration' => (float) $schedule->loan->restoration,
                'amount' => (float) $schedule->amount,
                'paid_amount' => (float) $schedule->paid_amount,
                'pending' => round(max(0, (float) $schedule->amount - (float) $schedule->paid_amount), 2),
                'is_paid' => (float) $schedule->paid_amount >= (float) $schedule->amount,
                'employee' => $schedule->loan->employee?->full_name,
                'date' => $schedule->due_date->toDateString(),
            ]);

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['amount', 'paid_amount', 'pending'])];
    }

    /**
     * Today Received: loan repayments in the range with their Principal / Interest split and reserve.
     *
     * @return array{rows: list<array<string, mixed>>, totals: array<string, float>}
     */
    public function received(ReportScope $scope): array
    {
        $rows = $scope->between($scope->apply(LoanTransaction::query(), 'loan_transactions'), 'transaction_date')
            ->where('type', 'deposit')
            ->with(['customer:id,first_name,middle_name,last_name,phone', 'branch:id,name', 'loan:id,duration,total_payable', 'employee:id,first_name,middle_name,last_name'])
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get()
            ->map(fn (LoanTransaction $transaction): array => [
                'id' => $transaction->id,
                'loan_id' => $transaction->loan_id,
                'customer_id' => $transaction->customer_id,
                'customer' => $transaction->customer?->full_name,
                'branch' => $transaction->branch?->name,
                'phone' => $transaction->customer?->phone,
                'duration' => $transaction->loan?->duration->label(),
                'total_payable' => (float) $transaction->loan?->total_payable,
                'amount' => (float) $transaction->amount,
                'principal' => (float) $transaction->principal,
                'penalty' => (float) $transaction->penalty,
                'interest' => (float) $transaction->interest,
                'reserve' => (float) $transaction->reserve,
                'employee' => $transaction->employee?->full_name,
                'date' => $transaction->transaction_date->toDateString(),
            ]);

        return ['rows' => $rows->values()->all(), 'totals' => $this->sums($rows, ['amount', 'principal', 'penalty', 'interest', 'reserve'])];
    }

    /**
     * Customer Development list: marked customers.
     *
     * @return list<array<string, mixed>>
     */
    public function markedCustomers(ReportScope $scope): array
    {
        return $scope->apply(Customer::query(), 'customers')
            ->where('is_marked', true)
            ->with('branch:id,name')
            ->orderBy('id')
            ->get()
            ->map(fn (Customer $customer): array => [
                'id' => $customer->id,
                'customer_code' => $customer->customer_code,
                'name' => $customer->full_name,
                'age' => $customer->date_of_birth ? (int) $customer->date_of_birth->age : $customer->age,
                'gender' => $customer->gender,
                'phone' => $customer->phone,
                'branch' => $customer->branch?->name,
            ])
            ->all();
    }

    /**
     * Customer Development for one customer: figures of the most recent cashed-out loan and every loan.
     *
     * @return array<string, mixed>
     */
    public function development(Customer $customer): array
    {
        $loans = LoanBalances::join(Loan::query()->where('loans.customer_id', $customer->id))
            ->with('category:id,name')
            ->orderByDesc('loans.id')
            ->get();
        $latest = $loans->first(fn (Loan $loan): bool => $loan->withdrawn_at !== null) ?? $loans->first();

        $salaryAdvance = (float) $customer->salaryAdvances()->where('status', 'active')->whereNull('reversed_at')->withSum('payments', 'amount')->get()
            ->sum(fn ($advance): float => max(0, (float) $advance->total_payable - (float) $advance->payments_sum_amount));

        return [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->full_name,
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'photo_url' => $customer->passport_photo ? $customer->photo_url : null,
                'is_marked' => (bool) $customer->is_marked,
            ],
            'summary' => [
                'phone' => $customer->phone,
                'withdrawal_date' => $latest?->withdrawn_at?->toDateString(),
                'end_date' => $latest?->end_date?->toDateString(),
                'total_payable' => (float) ($latest->total_payable ?? 0),
                'restoration' => (float) ($latest->restoration ?? 0),
                'paid' => round((float) ($latest->paid_total ?? 0), 2),
                'remain' => $latest ? round((float) $latest->out_total - (float) $latest->out_penalty, 2) : 0.0,
                'salary_advance' => round($salaryAdvance, 2),
                'penalty' => round((float) $loans->sum('out_penalty'), 2),
                'recovery' => round((float) WriteOff::whereIn('loan_id', $loans->modelKeys() ?: [0])->sum('recovered_amount'), 2),
                'status' => $latest?->status->label(),
                'status_badge' => $latest?->status->badge(),
            ],
            'loans' => $loans->map(fn (Loan $loan): array => [
                'id' => $loan->id,
                'loan_number' => $loan->loan_number,
                'product' => $loan->category?->name,
                'interest_rate' => (float) $loan->interest_rate,
                'amount' => (float) ($loan->amount_approved > 0 ? $loan->amount_approved : $loan->amount_applied),
                'total_payable' => (float) $loan->total_payable,
                'duration' => $loan->duration->label(),
                'sessions' => $loan->sessions,
                'restoration' => (float) $loan->restoration,
                'status' => $loan->status->label(),
                'status_badge' => $loan->status->badge(),
                'withdrawal_date' => $loan->withdrawn_at?->toDateString(),
                'end_date' => $loan->end_date?->toDateString(),
            ])->values()->all(),
        ];
    }

    /**
     * Scoped loans with outstanding balances joined.
     *
     * @param  list<LoanStatus>|null  $statuses
     * @return Builder<Loan>
     */
    public function loans(ReportScope $scope, ?array $statuses = null): Builder
    {
        return LoanBalances::join($scope->apply(Loan::query(), 'loans'))
            ->when($statuses !== null, fn (Builder $query) => $query->whereIn('loans.status', LoanStatus::values(...$statuses)))
            ->with(['customer:id,first_name,middle_name,last_name,phone,customer_code', 'branch:id,name', 'employee:id,first_name,middle_name,last_name'])
            ->orderBy('loans.id');
    }

    /**
     * @param  Builder<Loan>  $query
     * @param  (callable(Loan): array<string, mixed>)|null  $extra
     * @return Collection<int, array<string, mixed>>
     */
    private function loanRows(Builder $query, ?callable $extra = null): Collection
    {
        return $query->get()->map(fn (Loan $loan): array => array_merge([
            'id' => $loan->id,
            'loan_number' => $loan->loan_number,
            'reference_number' => $loan->reference_number,
            'branch' => $loan->branch?->name,
            'customer_id' => $loan->customer_id,
            'customer' => $loan->customer?->full_name,
            'phone' => $loan->customer?->phone,
            'employee' => $loan->employee?->full_name,
            'amount_approved' => (float) $loan->amount_approved,
            'interest_amount' => (float) $loan->interest_amount,
            'total_payable' => (float) $loan->total_payable,
            'restoration' => (float) $loan->restoration,
            'duration' => $loan->duration->label(),
            'sessions' => $loan->sessions,
            'paid' => round((float) $loan->paid_total, 2),
            'outstanding' => [
                'principal' => (float) $loan->out_principal,
                'penalty' => (float) $loan->out_penalty,
                'interest' => (float) $loan->out_interest,
                'insurance' => (float) $loan->out_insurance,
                'total' => (float) $loan->out_total,
            ],
            'remain' => (float) $loan->out_total,
            'penalty' => (float) $loan->out_penalty,
            'withdrawal_date' => $loan->withdrawn_at?->toDateString(),
            'end_date' => $loan->end_date?->toDateString(),
            'status' => $loan->status->label(),
            'status_badge' => $loan->status->badge(),
            'status_value' => $loan->status->value,
        ], $extra ? $extra($loan) : []));
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  list<string>  $columns
     * @return array<string, float>
     */
    private function sums(Collection $rows, array $columns): array
    {
        return collect($columns)->mapWithKeys(fn (string $column): array => [$column => round((float) $rows->sum($column), 2)])->all();
    }
}
