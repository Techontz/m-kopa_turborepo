<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\Capital;
use App\Models\DividendAllocation;
use App\Models\DividendDeclaration;
use App\Models\Employee;
use App\Models\ShareHolder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/**
 * Monthly profit distribution (Documents: ACCOUNT OVERVIEW "16. Dividend Account" and "F. DIVIDEND PROCESS";
 * handwritten note "SHARE HOLDER & CAPITAL").
 *
 *  - Profit → Dividend: Dr Profit Account (retained profit) for the declared profit.
 *  - 70% → Principal (reinvestment): credited to the Capital account ("some percentage should go to the main capital").
 *  - 30% → Shareholders: credited to the Dividend account and split by each shareholder's share percentage.
 *  - Withdrawal from the Dividend account: CASH (Company account) or BANK.
 */
class DividendService
{
    public const REINVEST_PERCENT = 70.0;

    public const DIVIDEND_PERCENT = 30.0;

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Undistributed profit (balance of the Profit account across all branches).
     */
    public function availableProfit(int $companyId): float
    {
        return $this->ledger->balance($companyId, Account::RetainedProfit, allBranches: true) + 0.0;
    }

    /**
     * Declared but not yet withdrawn dividends.
     */
    public function dividendBalance(int $companyId): float
    {
        return $this->ledger->balance($companyId, Account::DividendPayable, allBranches: true) + 0.0;
    }

    /**
     * Inferred: a shareholder's percentage is their share of total capital contributed (the live system stores
     * no explicit share percentage).
     *
     * @return Collection<int, array{share_holder: ShareHolder, capital: float, percent: float}>
     */
    public function shares(int $companyId): Collection
    {
        $capitals = Capital::where('company_id', $companyId)
            ->selectRaw('share_holder_id, SUM(amount) AS total')
            ->groupBy('share_holder_id')
            ->pluck('total', 'share_holder_id');
        $total = (float) $capitals->sum();

        return ShareHolder::where('company_id', $companyId)->orderBy('id')->get()
            ->map(fn (ShareHolder $holder): array => [
                'share_holder' => $holder,
                'capital' => (float) ($capitals[$holder->id] ?? 0),
                'percent' => $total > 0 ? round((float) ($capitals[$holder->id] ?? 0) / $total * 100, 4) : 0.0,
            ]);
    }

    /**
     * Distributable profit recorded by the month-end close for the period, when the accounting close has run.
     */
    public function closedPeriodProfit(int $companyId, CarbonImmutable $period): ?float
    {
        if (! Schema::hasTable('branch_period_results')) {
            return null;
        }

        $query = DB::table('branch_period_results')
            ->join('accounting_periods', 'accounting_periods.id', '=', 'branch_period_results.accounting_period_id')
            ->where('accounting_periods.company_id', $companyId)
            ->whereDate('accounting_periods.period_start', $period->startOfMonth()->toDateString());

        return (clone $query)->exists() ? round((float) $query->sum('branch_period_results.distributable_profit'), 2) : null;
    }

    public function declare(int $companyId, CarbonImmutable $period, float $profit, Employee $employee): DividendDeclaration
    {
        $profit = round($profit, 2);

        if ($profit > $this->availableProfit($companyId)) {
            throw ValidationException::withMessages(['profit_amount' => 'Insufficient balance in '.Account::RetainedProfit->label()]);
        }

        $shares = $this->shares($companyId)->filter(fn (array $share): bool => $share['percent'] > 0)->values();
        if ($shares->isEmpty()) {
            throw ValidationException::withMessages(['profit_amount' => 'No share holder has capital to receive dividend']);
        }

        $dividend = round($profit * self::DIVIDEND_PERCENT / 100, 2);
        $reinvest = round($profit - $dividend, 2);

        return DB::transaction(function () use ($companyId, $period, $profit, $employee, $shares, $dividend, $reinvest): DividendDeclaration {
            $declaration = DividendDeclaration::create([
                'company_id' => $companyId,
                'period' => $period->startOfMonth()->toDateString(),
                'profit_amount' => $profit,
                'reinvest_percent' => self::REINVEST_PERCENT,
                'reinvest_amount' => $reinvest,
                'dividend_percent' => self::DIVIDEND_PERCENT,
                'dividend_amount' => $dividend,
                'declared_by' => $employee->id,
            ]);

            $entry = $this->ledger->journal($companyId, 'DIVIDEND DECLARATION '.$period->format('Y-m'), [
                ['account' => Account::RetainedProfit, 'debit' => $profit],
                ['account' => Account::Capital, 'credit' => $reinvest],
                ['account' => Account::DividendPayable, 'credit' => $dividend],
            ], $declaration, employee: $employee);

            $declaration->update(['journal_entry_id' => $entry->id]);

            $allocated = 0.0;
            foreach ($shares as $index => $share) {
                $amount = $index === $shares->count() - 1
                    ? round($dividend - $allocated, 2)
                    : round($dividend * $share['percent'] / 100, 2);
                $allocated += $amount;

                $declaration->allocations()->create([
                    'company_id' => $companyId,
                    'share_holder_id' => $share['share_holder']->id,
                    'share_percent' => $share['percent'],
                    'amount' => $amount,
                    'status' => 'pending',
                ]);
            }

            return $declaration->load('allocations.shareHolder');
        });
    }

    /**
     * Withdraw a shareholder's dividend: Dr Dividend account, Cr Company account (CASH) or Bank (BANK).
     */
    public function pay(DividendAllocation $allocation, string $method, ?int $bankAccountId, ?string $reference, Employee $employee): DividendAllocation
    {
        if ($allocation->status !== 'pending') {
            throw ValidationException::withMessages(['pay_method' => 'Dividend is already paid']);
        }

        $amount = (float) $allocation->amount;
        $source = $method === 'BANK'
            ? ['account' => Account::Bank, 'bank' => $bankAccountId]
            : ['account' => Account::Company];

        $balance = $this->ledger->balance($allocation->company_id, $source['account'], bankAccount: $source['bank'] ?? null);
        if ($balance < $amount) {
            throw ValidationException::withMessages(['pay_method' => 'Insufficient balance in '.$source['account']->label()]);
        }

        return DB::transaction(function () use ($allocation, $method, $bankAccountId, $reference, $employee, $amount, $source): DividendAllocation {
            $locked = DividendAllocation::whereKey($allocation->id)->lockForUpdate()->first();
            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['pay_method' => 'Dividend is already paid']);
            }

            $this->ledger->transfer($allocation->company_id, $source, ['account' => Account::DividendPayable], $amount, 'DIVIDEND PAYMENT '.$allocation->shareHolder->name, $allocation);

            $allocation->update([
                'status' => 'paid',
                'pay_method' => $method,
                'bank_account_id' => $method === 'BANK' ? $bankAccountId : null,
                'reference' => $reference,
                'paid_by' => $employee->id,
                'paid_at' => now(),
            ]);

            return $allocation;
        });
    }
}
