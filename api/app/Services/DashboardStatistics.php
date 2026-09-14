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
use App\Models\ExpenseRequest;
use App\Models\FloatTransfer;
use App\Models\Loan;
use App\Models\LoanSchedule;
use App\Models\LoanTransaction;
use App\Models\PenaltyPayment;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvancePayment;
use App\Models\Saving;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class DashboardStatistics
{
    public function __construct(private readonly Ledger $ledger) {}

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
     * @return array{account_balance: float, loan_withdrawal: float, receivable: float, default_loan: float}
     */
    public function cards(Company $company, CarbonImmutable $today): array
    {
        return [
            'account_balance' => array_sum($this->accountBalances($company)),
            'loan_withdrawal' => (float) LoanTransaction::where('company_id', $company->id)->where('type', 'withdrawal')->whereDate('transaction_date', $today)->sum('amount'),
            'receivable' => (float) LoanSchedule::whereHas('loan', fn ($query) => $query->where('company_id', $company->id)->status(...LoanStatus::repayable()))
                ->whereDate('due_date', $today)->sum('amount'),
            'default_loan' => Loan::where('company_id', $company->id)->status(LoanStatus::Default)->get()->sum(fn (Loan $loan): float => $loan->remaining_amount),
        ];
    }

    /**
     * "Company Account List" modal: the company account followed by each bank account.
     *
     * @return array<string, float>
     */
    public function accountBalances(Company $company): array
    {
        $balances = ['Company A/C' => $this->ledger->balance($company, Account::Company)];

        foreach ($company->bankAccounts()->get() as $bankAccount) {
            $balances[$bankAccount->name] = $this->ledger->balance($company, Account::Bank, bankAccount: $bankAccount);
        }

        return $balances;
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function branchAccounts(Company $company): Collection
    {
        return $company->branches()->get()->map(fn (Branch $branch): array => [
            'name' => $branch->name,
            'principal' => $this->ledger->balance($company, Account::Principal, $branch),
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
     * @return array<string, float|int>
     */
    public function today(Company $company, CarbonImmutable $today): array
    {
        $deposits = fn (Duration $duration): float => (float) LoanTransaction::where('company_id', $company->id)->where('type', 'deposit')
            ->whereDate('transaction_date', $today)->whereHas('loan', fn ($query) => $query->where('duration', $duration->value))->sum('amount');
        $withdrawals = fn (Duration $duration): float => (float) LoanTransaction::where('company_id', $company->id)->where('type', 'withdrawal')
            ->whereDate('transaction_date', $today)->whereHas('loan', fn ($query) => $query->where('duration', $duration->value))->sum('amount');

        $figures = [
            'monthly_customers' => $this->customersWithDuration($company, Duration::Monthly)->count(),
            'weekly_customers' => $this->customersWithDuration($company, Duration::Weekly)->count(),
            'daily_customers' => $this->customersWithDuration($company, Duration::Daily)->count(),
            'groups' => $company->groups()->count(),
            'monthly_deposit' => $deposits(Duration::Monthly),
            'weekly_deposit' => $deposits(Duration::Weekly),
            'daily_deposit' => $deposits(Duration::Daily),
            'salary_advance_deposit' => (float) SalaryAdvancePayment::whereHas('salaryAdvance', fn ($query) => $query->where('company_id', $company->id))->whereDate('paid_on', $today)->sum('amount'),
            'agent_deposit' => (float) AgentTransaction::where('company_id', $company->id)->whereDate('transaction_date', $today)->sum('amount'),
            'monthly_withdrawal' => $withdrawals(Duration::Monthly),
            'weekly_withdrawal' => $withdrawals(Duration::Weekly),
            'daily_withdrawal' => $withdrawals(Duration::Daily),
            'salary_advance_withdrawal' => (float) SalaryAdvance::where('company_id', $company->id)->whereDate('approved_at', $today)->sum('amount'),
            'penalty_income' => (float) PenaltyPayment::whereHas('penalty', fn ($query) => $query->where('company_id', $company->id))->whereDate('paid_on', $today)->sum('amount'),
            'loan_fee_income' => $this->ledger->movement($company, Account::LoanFee, $today, $today),
            'capital_income' => (float) Capital::where('company_id', $company->id)->where('pay_method', '!=', 'ASSET')->whereDate('created_at', $today)->sum('amount'),
            'transfer_income' => (float) FloatTransfer::where('company_id', $company->id)->where('type', 'company_to_branch')->where('status', 'approved')->whereDate('transfer_date', $today)->sum('amount'),
            'insurance_income' => $this->ledger->movement($company, Account::Insurance, $today, $today),
            'expenses' => (float) ExpenseRequest::where('company_id', $company->id)->where('status', 'accepted')->whereDate('request_date', $today)->sum('amount'),
            'bank_expenses' => (float) ExpenseRequest::where('company_id', $company->id)->where('scope', 'bank')->where('status', 'accepted')->whereDate('request_date', $today)->sum('amount'),
            'transfer_expenses' => $this->ledger->movement($company, Account::Principal, $today, $today, inflow: false) - $withdrawals(Duration::Monthly) - $withdrawals(Duration::Weekly) - $withdrawals(Duration::Daily),
            'saving_withdrawal' => (float) Saving::where('company_id', $company->id)->where('type', 'withdrawal')->whereDate('transaction_date', $today)->sum('amount'),
            'all_customers' => Customer::where('company_id', $company->id)->count(),
        ];

        $figures['transfer_expenses'] = max(0, $figures['transfer_expenses']);
        $figures['total_deposit'] = $figures['monthly_deposit'] + $figures['weekly_deposit'] + $figures['daily_deposit'] + $figures['salary_advance_deposit'] + $figures['agent_deposit'];
        $figures['total_withdrawal'] = $figures['monthly_withdrawal'] + $figures['weekly_withdrawal'] + $figures['daily_withdrawal'] + $figures['salary_advance_withdrawal'];
        $figures['total_income'] = $figures['penalty_income'] + $figures['loan_fee_income'] + $figures['capital_income'] + $figures['transfer_income'] + $figures['insurance_income'];
        $figures['total_expenses'] = $figures['expenses'] + $figures['bank_expenses'] + $figures['transfer_expenses'] + $figures['saving_withdrawal'];

        return $figures;
    }

    /**
     * Rows of the customer type summary table (Monthly / Weekly / Day / Group / All Customer).
     *
     * @return array<int, array<string, mixed>>
     */
    public function customerTypes(Company $company): array
    {
        $rows = [
            ['label' => 'Monthly', 'route' => 'customers.monthly', 'customers' => $this->customersWithDuration($company, Duration::Monthly)],
            ['label' => 'Weekly', 'route' => 'customers.weekly', 'customers' => $this->customersWithDuration($company, Duration::Weekly)],
            ['label' => 'Day', 'route' => 'customers.daily', 'customers' => $this->customersWithDuration($company, Duration::Daily)],
            ['label' => 'Group', 'route' => 'groups.index', 'customers' => Customer::where('company_id', $company->id)->where('customer_type', 'group')->get()],
        ];
        $rows[] = ['label' => 'All Customer', 'route' => 'customers.index', 'customers' => Customer::where('company_id', $company->id)->get()];

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
     * @return Collection<int, Customer>
     */
    public function customersWithDuration(Company $company, Duration $duration): Collection
    {
        return Customer::where('company_id', $company->id)
            ->whereHas('loans', fn ($query) => $query->where('duration', $duration->value)->status(LoanStatus::Active, LoanStatus::Overdue, LoanStatus::Default, LoanStatus::Closed, LoanStatus::AwaitingDisbursement))
            ->get();
    }
}
