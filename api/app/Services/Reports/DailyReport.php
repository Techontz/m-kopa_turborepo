<?php

namespace App\Services\Reports;

use App\Enums\Account;
use App\Models\AgentTransaction;
use App\Models\BankTransfer;
use App\Models\Capital;
use App\Models\ExpenseRequest;
use App\Models\FloatTransfer;
use App\Models\JournalLine;
use App\Models\LoanTransaction;
use App\Models\PenaltyPayment;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvancePayment;
use App\Models\Saving;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * "Daily Report" cash book.
 *
 * The live formulas are server-side only; they are inferred as follows:
 * - OPENING / CLOSING: the cash position from the ledger — the sum of every ledger entry in scope
 *   (a branch's accounts, or all branch and HQ accounts for ALL) excluding money held in bank accounts,
 *   up to the day before "from" (opening) and up to "to" (closing). Opening therefore always equals
 *   the previous day's closing.
 * - Money in: CAPITAL (share capital, HQ only), TRANSFER (approved float received), DEPOSIT (loan
 *   repayments), AGENT (agent transactions), SAVING DEPOSIT, DEBT PENDING (salary advance repayments),
 *   LOAN FEE (loan fee ledger inflow), PENARTY (penalty payments).
 * - Money out: LOAN WITHDRAWAL, SAVING WITHDRAWAL, DEBT PENDING (salary advances issued), EXPENSES
 *   (accepted expense requests), BANK (branch → bank transfers), TRANSFER (approved float sent).
 */
class DailyReport
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * @return array{in: array<string, float>, out: array<string, float>, total_in: float, total_out: float, opening: float, closing: float}
     */
    public function build(ReportFilter $filter): array
    {
        $companyId = $filter->company->id;
        $branchId = $filter->branchId;
        $range = $filter->range();

        $scoped = fn (Builder $query, string $column = 'branch_id'): Builder => $query->where('company_id', $companyId)
            ->when($branchId, fn (Builder $inner, int $id) => $inner->where($column, $id));

        $in = [
            'CAPITAL' => $branchId ? 0.0 : (float) Capital::where('company_id', $companyId)->whereBetween('created_at', [$filter->from->startOfDay(), $filter->to->endOfDay()])->sum('amount'),
            'TRANSFER' => (float) FloatTransfer::where('company_id', $companyId)->where('status', 'approved')
                ->when($branchId, fn (Builder $query, int $id) => $query->where('to_branch_id', $id), fn (Builder $query) => $query->whereNotNull('to_branch_id'))
                ->whereBetween('transfer_date', $range)->sum('amount'),
            'DEPOSIT' => (float) $scoped(LoanTransaction::query())->where('type', 'deposit')->whereBetween('transaction_date', $range)->sum('amount'),
            'AGENT' => (float) $scoped(AgentTransaction::query())->whereBetween('transaction_date', $range)->sum('amount'),
            'SAVING DEPOSIT' => (float) $scoped(Saving::query())->where('type', 'deposit')->whereBetween('transaction_date', $range)->sum('amount'),
            'DEBT PENDING' => (float) SalaryAdvancePayment::whereHas('salaryAdvance', fn (Builder $query) => $scoped($query))->whereBetween('paid_on', $range)->sum('amount'),
            'LOAN FEE' => $this->ledger->movement($filter->company, Account::LoanFee, $filter->from, $filter->to, true, $branchId),
            'PENARTY' => (float) PenaltyPayment::whereHas('penalty', fn (Builder $query) => $scoped($query))->whereBetween('paid_on', $range)->sum('amount'),
        ];

        $out = [
            'LOAN WITHDRAWAL' => (float) $scoped(LoanTransaction::query())->where('type', 'withdrawal')->whereBetween('transaction_date', $range)->sum('amount'),
            'SAVING WITHDRAWAL' => (float) $scoped(Saving::query())->where('type', 'withdrawal')->whereBetween('transaction_date', $range)->sum('amount'),
            'DEBT PENDING' => (float) $scoped(SalaryAdvance::query())->whereNotNull('approved_at')->whereBetween('approved_at', [$filter->from->startOfDay(), $filter->to->endOfDay()])->sum('amount'),
            'EXPENSES' => (float) $scoped(ExpenseRequest::query())->where('status', 'accepted')->whereBetween('request_date', $range)->sum('amount'),
            'BANK' => (float) $scoped(BankTransfer::query())->where('type', 'branch_to_bank')->where('status', 'approved')->whereBetween('transfer_date', $range)->sum('amount'),
            'TRANSFER' => (float) FloatTransfer::where('company_id', $companyId)->where('status', 'approved')
                ->when($branchId, fn (Builder $query, int $id) => $query->where('from_branch_id', $id), fn (Builder $query) => $query->whereNotNull('from_branch_id'))
                ->whereBetween('transfer_date', $range)->sum('amount'),
        ];

        return [
            'in' => $in,
            'out' => $out,
            'total_in' => array_sum($in),
            'total_out' => array_sum($out),
            'opening' => $this->cashPosition($companyId, $branchId, $filter->from->subDay()),
            'closing' => $this->cashPosition($companyId, $branchId, $filter->to),
        ];
    }

    private function cashPosition(int $companyId, ?int $branchId, CarbonImmutable $until): float
    {
        $moneyAccounts = array_map(fn (Account $account): string => $account->value, array_filter(
            Account::cases(),
            fn (Account $account): bool => $account->type() === 'asset' && ! in_array($account, [Account::Bank, Account::LoanReceivable, Account::LoanArrears, Account::LoanDefault, Account::SalaryAdvanceReceivable, Account::StaffLoanReceivable, Account::StaffAdvanceReceivable], true),
        ));

        $totals = JournalLine::query()
            ->join('accounts', 'accounts.id', '=', 'journal_lines.account_id')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_lines.journal_entry_id')
            ->where('accounts.company_id', $companyId)
            ->whereIn('accounts.key', $moneyAccounts)
            ->when($branchId, fn ($query, int $id) => $query->where('accounts.branch_id', $id))
            ->whereDate('journal_entries.entry_date', '<=', $until->toDateString())
            ->selectRaw('COALESCE(SUM(journal_lines.debit),0) d, COALESCE(SUM(journal_lines.credit),0) c')
            ->first();

        return round((float) $totals->d - (float) $totals->c, 2);
    }
}
