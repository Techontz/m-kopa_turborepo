<?php

namespace App\Services;

use App\Enums\Account;
use App\Enums\Duration;
use App\Enums\LoanStatus;
use App\Models\AgentTransaction;
use App\Models\Branch;
use App\Models\Capital;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\ExpenseRequest;
use App\Models\FloatTransfer;
use App\Models\Loan;
use App\Models\LoanSchedule;
use App\Models\LoanTransaction;
use App\Models\Penalty;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvancePayment;
use App\Models\Saving;
use App\Services\Reports\Financial\CashAccounts;
use App\Services\Reports\Financial\ProfitLossReport;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class DashboardStatistics
{
    /**
     * Keys of {@see today()} that describe company money; hidden from branch- and zone-scoped employees.
     */
    public const COMPANY_MONEY_MOVEMENTS = ['capital_received', 'float_to_hq', 'principal_transfers_out', 'expenses_paid_from_bank'];

    public function __construct(
        private readonly Ledger $ledger,
        private readonly ProfitLossReport $profitLoss,
        private readonly CashAccounts $cash,
        private readonly AccessControl $access,
    ) {}

    /**
     * @return array<string, float>
     */
    public function headerAccounts(Company $company): array
    {
        return [
            'Loan Fee A/c' => $this->ledger->balance($company, Account::LoanFee, allBranches: true),
            'Penalty A/c' => $this->ledger->balance($company, Account::Penalty, allBranches: true),
            'Interest A/c' => $this->ledger->balance($company, Account::Interest, allBranches: true),
            'Reserve A/c' => $this->ledger->balance($company, Account::Reserve, allBranches: true),
        ];
    }

    /**
     * Stat cards. The green card is:
     *  - the Investment ({@see accountBalances()}: COMPANY ACCOUNT + bank accounts + Investment reserve + assets) for a
     *    company-wide employee who may see capital — the owners' position, never shown to HQ;
     *  - HQ funds ({@see hqFunds()}: the PRINCIPAL A/C the company floated to HQ plus the HQ income pools) for every other
     *    company-wide employee (HQ, Finance);
     *  - the PETTY CASH A/C of their branches ({@see pettyCash()}) for branch- and zone-scoped employees — the only money a
     *    branch holds. Their loan withdrawal, receivable and default loan cover those branches only.
     *
     * @param  list<int>|null  $branchIds
     * @return array{account_balance: float, account_balance_title: string, account_balance_label: string, loan_withdrawal: float, receivable: float, default_loan: float}
     */
    public function cards(Company $company, CarbonImmutable $today, ?array $branchIds = null, bool $investment = true): array
    {
        $inBranches = fn (Builder $query): Builder => $branchIds === null ? $query : $query->whereIn('branch_id', $branchIds);

        $green = match (true) {
            $branchIds !== null => ['Petty Cash', 'Sent by HQ — spent only with HQ approval', $this->pettyCash($company, $branchIds)],
            $investment => ['Account Balance', 'Company A/C + banks + reserve + assets', round(array_sum($this->accountBalances($company)), 2)],
            default => ['HQ Funds', 'Received from the company + HQ income', round(array_sum($this->hqFunds($company)), 2)],
        };

        return [
            'account_balance' => $green[2],
            'account_balance_title' => $green[0],
            'account_balance_label' => $green[1],
            'loan_withdrawal' => (float) $inBranches(LoanTransaction::where('company_id', $company->id))->where('type', 'withdrawal')->whereNull('reversed_at')->whereDate('transaction_date', $today)->sum('amount'),
            'receivable' => (float) LoanSchedule::whereHas('loan', fn ($query) => $inBranches($query->where('company_id', $company->id))->status(...LoanStatus::repayable()))
                ->whereDate('due_date', $today)->sum('amount'),
            'default_loan' => $inBranches(Loan::where('company_id', $company->id))->status(LoanStatus::Default)->get()->sum(fn (Loan $loan): float => $loan->remaining_amount),
        ];
    }

    /**
     * PETTY CASH A/C balance of the given branches: petty cash HQ has sent them out of interest income, which they spend only
     * on expenses HQ approves. It is the only money a branch holds.
     *
     * @param  list<int>  $branchIds
     */
    public function pettyCash(Company $company, array $branchIds): float
    {
        return round(array_sum(array_map(fn (int $branchId): float => $this->ledger->balance($company, Account::PettyCash, $branchId), $branchIds)), 2) + 0.0;
    }

    /**
     * HQ funds — what HQ and Finance see instead of the owners' Investment: the lending money the company floated to HQ and
     * the income HQ holds. Every branch-tagged fund account is included, because a branch holds no money of its own: the
     * branch figure is only a report of what that branch generated.
     *
     * Every account is listed, empty ones included, so the modal reads as the full account list rather than as whichever
     * accounts happen to hold money today. The HQ accounts are prefixed "HQ " because several of them share a name with a
     * fund pool above (PENALTY, INTEREST, RESERVE, LOAN FEE).
     *
     * @return array<string, float>
     */
    public function hqFunds(Company $company): array
    {
        $pool = fn (Account $account): float => $this->ledger->balance($company, $account, allBranches: true) + 0.0;

        $balances = [
            'PRINCIPAL A/C' => $pool(Account::Principal),
            'INTEREST A/C' => $pool(Account::Interest),
            'LOAN FEE A/C' => $pool(Account::LoanFee),
            'PENALTY A/C' => $pool(Account::Penalty),
            'RESERVE A/C' => $pool(Account::Reserve),
            'INSURANCE A/C' => $pool(Account::Insurance),
            'AGENT A/C' => $pool(Account::Agent),
            'TELLER CASH A/C' => $pool(Account::TellerCash),
            'PETTY CASH A/C (branches)' => $pool(Account::PettyCash),
        ];

        foreach ($this->hqAccounts($company)['rows'] as $row) {
            $balances['HQ '.$row['name']] = $row['name'] === Account::HqReserve->label()
                ? $this->ledger->balance($company, Account::HqReserve) + 0.0
                : $row['balance'];
        }

        return $balances;
    }

    /**
     * "Company Account List" (Investment) modal: the company account, each bank account, the Investment RESERVE A/C
     * (only reserve HQ has already sent — it can differ from the HQ reserve), then one Assets row
     * = the total of every fixed asset account (assets contributed as capital).
     *
     * @return array<string, float>
     */
    public function accountBalances(Company $company): array
    {
        $balances = $this->cash->companyAccounts($company) + [
            'Reserve A/C' => $this->ledger->balance($company, Account::InvestmentReserve) + 0.0,
        ];

        $balances['Assets'] = round(array_sum(array_map(fn (Account $asset): float => $this->ledger->balance($company, $asset, allBranches: true), Account::fixedAssets())), 2) + 0.0;

        return $balances;
    }

    /**
     * The memo lines the live account modal prints under TOTAL: today's savings deposits, what staff still owe on salary
     * advances and the customer savings still held. None of them are part of the total — they say what some of the money
     * is owed to (savings) or still to come back (advances).
     *
     * @param  list<int>|null  $branchIds  null = the whole company
     * @return list<array{label: string, amount: float, tone: string}>
     */
    public function accountMemos(Company $company, ?array $branchIds = null): array
    {
        $inBranches = fn (Builder $query): Builder => $branchIds === null ? $query : $query->whereIn('branch_id', $branchIds);

        $savingDeposit = (float) $inBranches(Saving::where('company_id', $company->id))
            ->where('type', 'deposit')->whereNull('reversed_at')
            ->whereDate('transaction_date', CarbonImmutable::today())->sum('amount');

        $advances = $inBranches(SalaryAdvance::where('company_id', $company->id))
            ->where('status', 'active')->withSum('payments', 'amount')->get();
        $advanceRemaining = round($advances->sum(fn (SalaryAdvance $advance): float => $advance->remaining_amount), 2);

        $savingHeld = $branchIds === null
            ? $this->ledger->balance($company, Account::HqSaving, allBranches: true)
            : array_sum(array_map(fn (int $branchId): float => $this->ledger->balance($company, Account::HqSaving, $branchId), $branchIds));

        return [
            ['label' => 'Saving Deposit', 'amount' => round($savingDeposit, 2), 'tone' => 'danger'],
            ['label' => 'Salary advance Remain', 'amount' => $advanceRemaining, 'tone' => 'primary'],
            ['label' => 'Saving Remain', 'amount' => round($savingHeld, 2), 'tone' => 'success'],
        ];
    }

    /**
     * "Branch List" modal. A branch holds no lending money — HQ funds every loan — so the first column is the PETTY CASH
     * A/C HQ sent it; the rest report the income the branch generated, which belongs to HQ.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function branchAccounts(Company $company): Collection
    {
        return $company->branches()->get()->map(fn (Branch $branch): array => [
            'name' => $branch->name,
            'petty_cash' => $this->ledger->balance($company, Account::PettyCash, $branch),
            'interest' => $this->ledger->balance($company, Account::Interest, $branch),
            'loan_fee' => $this->ledger->balance($company, Account::LoanFee, $branch),
            'penalty' => $this->ledger->balance($company, Account::Penalty, $branch),
            'reserve' => $this->ledger->balance($company, Account::Reserve, $branch),
            'agent' => $this->ledger->balance($company, Account::Agent, $branch),
            'insurance' => $this->ledger->balance($company, Account::Insurance, $branch),
        ]);
    }

    /**
     * Figures for the "Customer type / Today deposit / withdrawal / income / expenses" table.
     *
     * Deposits / withdrawals are cash-book movements (reversed records excluded). Income and expenses come from the ledger
     * (entries dated today, month-end closing entries excluded) with the components of the branch Profit & Loss
     * ({@see ProfitLossReport::row()}): interest net of reserve + loan fees + penalties + recoveries = total income;
     * insurance is shown but, as in the branch P&L, not part of total income. Capital received, float sent to HQ and
     * other principal transfers are money movements — never income or expenses (spec Rule 1, §12, §19).
     * $branchIds null = whole company. With branch ids (branch- and zone-scoped employees) every figure covers those branches
     * only and the company money movements (capital, float, principal transfers, expenses paid from the company bank) are null.
     *
     * @param  list<int>|null  $branchIds
     * @return array<string, float|int|null>
     */
    public function today(Company $company, CarbonImmutable $today, ?array $branchIds = null): array
    {
        $inBranches = fn (Builder $query): Builder => $branchIds === null ? $query : $query->whereIn($query->getModel()->qualifyColumn('branch_id'), $branchIds);
        $loanTransactions = fn (string $type, Duration $duration): float => (float) $inBranches(LoanTransaction::where('company_id', $company->id))->where('type', $type)->whereNull('reversed_at')
            ->whereDate('transaction_date', $today)->whereHas('loan', fn ($query) => $query->where('duration', $duration->value))->sum('amount');
        $withdrawals = fn (Duration $duration): float => $loanTransactions('withdrawal', $duration);
        $customers = fn (): Builder => $inBranches(Customer::where('company_id', $company->id));

        $raw = $this->profitLoss->companyFigures((int) $company->id, $today, $today, $branchIds);
        $pnl = $this->profitLoss->row($raw);
        $operatingExpenses = (float) ($raw[Account::OperatingExpense->value] ?? 0);

        $figures = [
            'monthly_customers' => $this->customersWithDuration($company, Duration::Monthly, $branchIds)->count(),
            'weekly_customers' => $this->customersWithDuration($company, Duration::Weekly, $branchIds)->count(),
            'daily_customers' => $this->customersWithDuration($company, Duration::Daily, $branchIds)->count(),
            'groups' => $branchIds === null ? $company->groups()->count() : $customers()->whereNotNull('group_id')->distinct()->count('group_id'),
            'monthly_deposit' => $loanTransactions('deposit', Duration::Monthly),
            'weekly_deposit' => $loanTransactions('deposit', Duration::Weekly),
            'daily_deposit' => $loanTransactions('deposit', Duration::Daily),
            'salary_advance_deposit' => (float) SalaryAdvancePayment::whereHas('salaryAdvance', fn ($query) => $inBranches($query->where('company_id', $company->id)->whereNull('reversed_at')))->whereDate('paid_on', $today)->sum('amount'),
            'agent_deposit' => (float) $inBranches(AgentTransaction::where('company_id', $company->id))->whereNull('reversed_at')->whereDate('transaction_date', $today)->sum('amount'),
            'monthly_withdrawal' => $withdrawals(Duration::Monthly),
            'weekly_withdrawal' => $withdrawals(Duration::Weekly),
            'daily_withdrawal' => $withdrawals(Duration::Daily),
            'salary_advance_withdrawal' => (float) $inBranches(SalaryAdvance::where('company_id', $company->id))->whereNull('reversed_at')->whereDate('approved_at', $today)->sum('amount'),

            'interest_income' => $pnl['interest_income'],
            'reserve_amount' => $pnl['reserve_amount'],
            'penalty_income' => $pnl['penalty_income'],
            'loan_fee_income' => $pnl['fee_income'],
            'recovery_income' => $pnl['recovery_income'],
            'insurance_income' => round((float) ($raw[Account::InsuranceIncome->value] ?? 0) + (float) ($raw[ProfitLossReport::INSURANCE_RESERVE_COLLECTED] ?? 0), 2),
            'total_income' => $pnl['total_income'],

            'expenses' => round($operatingExpenses, 2),
            'expenses_paid_from_bank' => (float) $inBranches(ExpenseRequest::where('company_id', $company->id))->where('status', 'accepted')->whereNull('reversed_at')
                ->where('paid_from_account', Account::Bank->value)->whereDate('approved_at', $today)->sum('amount'),
            'other_expenses' => round($pnl['expenses'] - $operatingExpenses, 2),
            'total_expenses' => $pnl['expenses'],
            'net_income' => round($pnl['total_income'] - $pnl['expenses'], 2),

            'capital_received' => (float) Capital::where('company_id', $company->id)->active()->where('pay_method', '!=', 'ASSET')
                ->whereRaw('DATE(COALESCE(contributed_at, created_at)) = ?', [$today->toDateString()])->sum('amount'),
            'float_to_hq' => (float) FloatTransfer::where('company_id', $company->id)->where('type', 'company_to_hq')->where('status', 'approved')->whereNull('reversed_at')->whereDate('transfer_date', $today)->sum('amount'),
            'principal_transfers_out' => $this->ledger->movement($company, Account::Principal, $today, $today, inflow: false) - $withdrawals(Duration::Monthly) - $withdrawals(Duration::Weekly) - $withdrawals(Duration::Daily),
            'saving_withdrawal' => (float) $inBranches(Saving::where('company_id', $company->id))->where('type', 'withdrawal')->whereNull('reversed_at')->whereDate('transaction_date', $today)->sum('amount'),
            'all_customers' => $customers()->count(),
        ];

        $figures['principal_transfers_out'] = round(max(0, $figures['principal_transfers_out']), 2);
        if ($branchIds !== null) {
            $figures = array_merge($figures, array_fill_keys(self::COMPANY_MONEY_MOVEMENTS, null));
        }
        $figures['total_deposit'] = round($figures['monthly_deposit'] + $figures['weekly_deposit'] + $figures['daily_deposit'] + $figures['salary_advance_deposit'] + $figures['agent_deposit'], 2);
        $figures['total_withdrawal'] = round($figures['monthly_withdrawal'] + $figures['weekly_withdrawal'] + $figures['daily_withdrawal'] + $figures['salary_advance_withdrawal'], 2);

        return $figures;
    }

    /**
     * Finance dashboard KPI blocks computed on the server (the browser only displays them). Branch-scoped employees see
     * their branches only, like the Penalty and Salary Advance pages. A block is null when the employee may not see it.
     *
     * @param  array{penalty: bool, salary_advance: bool, hq_accounts: bool, company_accounts: bool, account_balance?: bool}  $visible
     * @return array<string, mixed>
     */
    public function financeKpis(Employee $employee, array $visible): array
    {
        $company = $employee->company;
        $hq = $visible['hq_accounts'] ? $this->hqAccounts($company) : null;
        $companyAccounts = $visible['company_accounts'] ? $this->accountBalances($company) : null;

        return [
            'penalty' => $visible['penalty'] ? $this->penaltyKpi($employee) : null,
            'salary_advance' => $visible['salary_advance'] ? $this->salaryAdvanceKpis($employee) : null,
            'hq_accounts' => $hq,
            'company_accounts' => $companyAccounts === null ? null : [
                'rows' => collect($companyAccounts)->map(fn (float $balance, string $name): array => ['name' => $name, 'balance' => $balance])->values()->all(),
                'total' => round(array_sum($companyAccounts), 2),
            ],
            'account_balance' => ! ($visible['account_balance'] ?? true) ? null : ($hq !== null
                ? ['label' => 'HQ accounts', 'amount' => $hq['total']]
                : ['label' => 'Company A/C + banks + reserve + assets', 'amount' => round(array_sum($companyAccounts ?? $this->accountBalances($company)), 2)]),
        ];
    }

    /**
     * "Penalty (x%)": penalty money collected (paid part of every penalty, including penalties waived after a part payment)
     * against collected + still outstanding (unwaived penalties' unpaid part) — the same outstanding penalty as
     * {@see LoanService::outstanding()}.
     *
     * @return array{collected: float, remaining: float, due: float, percent: float}
     */
    public function penaltyKpi(Employee $employee): array
    {
        $penalties = fn (): Builder => $this->access->scope(Penalty::query(), $employee);
        $collected = round((float) $penalties()->sum('paid_amount'), 2);
        $remaining = round((float) $penalties()->where('is_waived', false)->whereColumn('paid_amount', '<', 'amount')->selectRaw('COALESCE(SUM(amount - paid_amount), 0) AS remaining')->value('remaining'), 2);

        return self::progress($collected, round($collected + $remaining, 2)) + ['remaining' => $remaining];
    }

    /**
     * Salary advance KPIs over the employee's advances (reversed advances excluded):
     * - received: paid against payable of ACTIVE and DONE advances (Salary Advance Loan Repayment page);
     * - default: ACTIVE advances with a balance whose repayment cycle has ended — cycle end = the 5th of the month after
     *   approval (creation when not yet approved), the rule of the Active Salary Advance page's "old" alert. Percent = unpaid share
     *   of what they owe; collected/due = paid / payable;
     * - customers: active advances, split into new (cycle still running) and old (cycle ended).
     *
     * @return array{received: array{collected: float, due: float, percent: float}, default: array{collected: float, due: float, unpaid: float, percent: float, count: int}, customers: array{active: int, new: int, old: int}}
     */
    public function salaryAdvanceKpis(Employee $employee): array
    {
        $advances = $this->access->scope(SalaryAdvance::query(), $employee)
            ->whereIn('status', ['active', 'done'])
            ->whereNull('reversed_at')
            ->withSum('payments', 'amount')
            ->get()
            ->map(fn (SalaryAdvance $advance): array => [
                'status' => $advance->status,
                'payable' => (float) $advance->total_payable,
                'paid' => (float) $advance->payments_sum_amount,
                'remaining' => max(0.0, round((float) $advance->total_payable - (float) $advance->payments_sum_amount, 2)),
                'cycle_ended' => self::repaymentCycleEnded($advance),
            ]);

        $active = $advances->where('status', 'active');
        $old = $active->where('cycle_ended', true);
        $defaulted = $old->where('remaining', '>', 0);

        $defaultDue = round((float) $defaulted->sum('payable'), 2);
        $unpaid = round((float) $defaulted->sum('remaining'), 2);

        return [
            'received' => self::progress(round((float) $advances->sum('paid'), 2), round((float) $advances->sum('payable'), 2)),
            'default' => [
                'collected' => round((float) $defaulted->sum('paid'), 2),
                'due' => $defaultDue,
                'unpaid' => $unpaid,
                'percent' => self::percent($unpaid, $defaultDue),
                'count' => $defaulted->count(),
            ],
            'customers' => ['active' => $active->count(), 'new' => $active->count() - $old->count(), 'old' => $old->count()],
        ];
    }

    /**
     * HQ account balances (HQ Transactions page) and their total. The RESERVE ACCOUNT row is the whole HQ reserve
     * ({@see CashAccounts::hqReserve()}: every branch RESERVE A/C + the HQ RESERVE ACCOUNT).
     *
     * @return array{rows: list<array{account: string, name: string, balance: float}>, total: float}
     */
    public function hqAccounts(Company $company): array
    {
        $rows = array_map(fn (Account $account): array => [
            'account' => $account->value,
            'name' => $account->label(),
            'balance' => ($account === Account::HqReserve ? $this->cash->hqReserve($company) : $this->ledger->balance($company, $account)) + 0.0,
        ], Account::hqAccounts());

        return ['rows' => $rows, 'total' => round(array_sum(array_column($rows, 'balance')), 2)];
    }

    /**
     * Whether a salary advance's repayment cycle (to the 5th of the month after approval) has ended.
     */
    public static function repaymentCycleEnded(SalaryAdvance $advance, ?CarbonImmutable $now = null): bool
    {
        $start = CarbonImmutable::parse($advance->approved_at ?? $advance->created_at);

        return $start->addMonthNoOverflow()->day(5)->lt($now ?? CarbonImmutable::now());
    }

    /**
     * @return array{collected: float, due: float, percent: float}
     */
    public static function progress(float $collected, float $due): array
    {
        return ['collected' => $collected, 'due' => $due, 'percent' => self::percent($collected, $due)];
    }

    /**
     * Percentage rounded to two decimals; 0 when the whole is 0.
     */
    public static function percent(float $part, float $whole): float
    {
        return abs($whole) < 0.005 ? 0.0 : round($part / $whole * 100, 2);
    }

    /**
     * Rows of the customer type summary table (Monthly / Weekly / Day / Group / All Customer); $branchIds limits them to
     * those branches.
     *
     * @param  list<int>|null  $branchIds
     * @return array<int, array<string, mixed>>
     */
    public function customerTypes(Company $company, ?array $branchIds = null): array
    {
        $customers = fn (): Builder => $branchIds === null ? Customer::where('company_id', $company->id) : Customer::where('company_id', $company->id)->whereIn('branch_id', $branchIds);
        $rows = [
            ['label' => 'Monthly', 'route' => 'customers.monthly', 'customers' => $this->customersWithDuration($company, Duration::Monthly, $branchIds)],
            ['label' => 'Weekly', 'route' => 'customers.weekly', 'customers' => $this->customersWithDuration($company, Duration::Weekly, $branchIds)],
            ['label' => 'Day', 'route' => 'customers.daily', 'customers' => $this->customersWithDuration($company, Duration::Daily, $branchIds)],
            ['label' => 'Group', 'route' => 'groups.index', 'customers' => $customers()->where('customer_type', 'group')->get()],
        ];
        $rows[] = ['label' => 'All Customer', 'route' => 'customers.index', 'customers' => $customers()->get()];

        return array_map(fn (array $row): array => $row + [
            'all' => $row['customers']->count(),
            'active' => $row['customers']->where('status', 'open')->count(),
            'pending' => $row['customers']->where('status', 'pending')->count(),
            'close' => $row['customers']->where('status', 'close')->count(),
            'default' => $row['customers']->where('status', 'out')->count(),
            'male' => $row['customers']->where('gender', 'male')->count(),
            'female' => $row['customers']->where('gender', 'female')->count(),
        ], $rows);
    }

    /**
     * @param  list<int>|null  $branchIds
     * @return Collection<int, Customer>
     */
    public function customersWithDuration(Company $company, Duration $duration, ?array $branchIds = null): Collection
    {
        return Customer::where('company_id', $company->id)
            ->when($branchIds !== null, fn (Builder $query) => $query->whereIn('branch_id', $branchIds))
            ->whereHas('loans', fn ($query) => $query->where('duration', $duration->value)->status(LoanStatus::Active, LoanStatus::Overdue, LoanStatus::Default, LoanStatus::Closed, LoanStatus::AwaitingDisbursement))
            ->get();
    }
}
