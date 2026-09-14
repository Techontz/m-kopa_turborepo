<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\AccountingPeriod;
use App\Models\BankAccount;
use App\Models\Company;
use App\Models\DividendAllocation;
use App\Models\DividendDeclaration;
use App\Models\DividendPayment;
use App\Models\DividendPaymentBatch;
use App\Models\Employee;
use App\Models\ShareHolder;
use App\Services\Dividends\DividendMath;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Monthly profit distribution (Documents: ACCOUNT OVERVIEW "16. Dividend Account" and "F. DIVIDEND PROCESS";
 * handwritten note "SHARE HOLDER & CAPITAL").
 *
 *  - PROFIT AVAILABLE is computed, never typed:
 *      • period closed by the month-end close → Σ branch distributable profit of that month, capped by the undistributed
 *        PROFIT ACCOUNT balance (profit already distributed or absorbed by losses cannot be distributed again);
 *      • period not closed → the undistributed PROFIT ACCOUNT balance (profit already posted to the Profit account by
 *        earlier closes / adjustments).
 *  - SPLIT from Settings → Dividend Settings (company percentages, default 30 shareholders / 70 principal
 *    reinvestment, always totalling 100): pool = profit × shareholder %, reinvestment = profit − pool.
 *  - DECLARATION (one per company per month): Dr PROFIT ACCOUNT (profit) / Cr CAPITAL ACCOUNT (reinvestment) /
 *    Cr DIVIDEND ACCOUNT (pool). Entitlements are split by share-register ownership on the declaration date (shares
 *    held ÷ total issued shares, {@see ShareholderOwnership}) and snapshotted; later share movements never change them.
 *  - PAYMENT (full or partial, CASH or BANK): Dr DIVIDEND ACCOUNT / Cr COMPANY ACCOUNT or the bank account. The
 *    remaining balance is re-read under a row lock on the allocation, so concurrent payments cannot overpay.
 *  - REVERSAL of a payment: opposite journal entry via {@see Ledger::reverse()}; the entitlement balance is restored.
 */
class DividendService
{
    public const PROFIT_SOURCE_PERIOD_CLOSE = 'period_close';

    public const PROFIT_SOURCE_PROFIT_ACCOUNT = 'profit_account';

    public function __construct(
        private readonly Ledger $ledger,
        private readonly ShareholderOwnership $ownership,
    ) {}

    /**
     * Company dividend split percentages ("30.00" / "70.00").
     *
     * @return array{dividend_percent: string, reinvest_percent: string}
     */
    public function settings(int $companyId): array
    {
        $company = Company::query()->findOrFail($companyId);

        return [
            'dividend_percent' => number_format((float) $company->dividend_shareholder_percent, 2, '.', ''),
            'reinvest_percent' => number_format((float) $company->dividend_reinvest_percent, 2, '.', ''),
        ];
    }

    /**
     * Undistributed profit: balance of the Profit account across all branches.
     */
    public function profitAccountBalance(int $companyId): float
    {
        return $this->ledger->balance($companyId, Account::RetainedProfit, allBranches: true) + 0.0;
    }

    /**
     * Declared but not yet paid dividends (Dividend account balance).
     */
    public function dividendBalance(int $companyId): float
    {
        return $this->ledger->balance($companyId, Account::DividendPayable, allBranches: true) + 0.0;
    }

    /**
     * Shareholder ownership from the share register on a date (today when null).
     *
     * @return Collection<int, array{share_holder: ShareHolder, capital: float, shares: int, total_shares: int, percent: float}>
     */
    public function shares(int $companyId, ?CarbonInterface $asOf = null): Collection
    {
        return $this->ownership->summary($companyId, $asOf ?? CarbonImmutable::today())
            ->map(fn (array $row): array => [
                'share_holder' => $row['share_holder'],
                'capital' => $row['total_contributed'],
                'shares' => $row['shares'],
                'total_shares' => $row['total_shares'],
                'percent' => $row['ownership_percent'],
            ]);
    }

    /**
     * Distributable profit recorded by the month-end close for a CLOSED period; null when the period is not closed.
     */
    public function closedPeriodProfit(int $companyId, CarbonImmutable $period): ?float
    {
        $accountingPeriod = AccountingPeriod::query()
            ->where('company_id', $companyId)
            ->whereDate('period_start', $period->startOfMonth()->toDateString())
            ->where('status', AccountingPeriod::STATUS_CLOSED)
            ->first();

        return $accountingPeriod === null ? null : round((float) $accountingPeriod->results()->sum('distributable_profit'), 2);
    }

    /**
     * Profit Available for a period (see class docs).
     *
     * @return array{period: string, period_label: string, profit_available: float, source: string, period_closed: bool, period_profit: ?float, profit_account_balance: float, note: string}
     */
    public function availableProfit(int $companyId, CarbonImmutable $period): array
    {
        $period = $period->startOfMonth();
        $balance = $this->profitAccountBalance($companyId);
        $closed = $this->closedPeriodProfit($companyId, $period);
        $label = $period->format('F Y');

        if ($closed !== null) {
            $available = max(0.0, min($closed, $balance));
            $note = "Distributable profit from the {$label} month-end close".($available < $closed ? ', limited to the undistributed Profit Account balance.' : '.');
        } else {
            $available = max(0.0, $balance);
            $note = "The month-end close has not run for {$label}; Profit Available is the undistributed Profit Account balance.";
        }

        return [
            'period' => $period->format('Y-m'),
            'period_label' => $label,
            'profit_available' => round($available, 2),
            'source' => $closed !== null ? self::PROFIT_SOURCE_PERIOD_CLOSE : self::PROFIT_SOURCE_PROFIT_ACCOUNT,
            'period_closed' => $closed !== null,
            'period_profit' => $closed,
            'profit_account_balance' => round($balance, 2),
            'note' => $note,
        ];
    }

    /**
     * Everything a declaration for the period would record, computed exactly like {@see declare()}.
     *
     * @return array{period: string, period_label: string, profit_available: float, profit_source: string, period_closed: bool, period_profit: ?float, profit_account_balance: float, profit_note: string, dividend_percent: float, reinvest_percent: float, dividend_pool: float, reinvestment_amount: float, total_shares: int, as_of_date: string, declaration_id: ?int, already_declared: bool, can_declare: bool, blocking_reason: ?string, rows: list<array{share_holder_id: int, name: string, shares: int, total_shares: int, ownership_percent: float, entitlement: float, contribution_total: float}>}
     */
    public function preview(int $companyId, CarbonImmutable $period): array
    {
        $period = $period->startOfMonth();
        $profit = $this->availableProfit($companyId, $period);
        $settings = $this->settings($companyId);
        $asOf = CarbonImmutable::today();
        $computed = $this->compute($companyId, $profit['profit_available'], $settings['dividend_percent'], $asOf);
        $existing = DividendDeclaration::where('company_id', $companyId)->whereDate('period', $period->toDateString())->value('id');

        $blocking = match (true) {
            $existing !== null => $this->alreadyDeclaredMessage($period),
            $profit['profit_available'] <= 0 => "There is no profit available to distribute for {$profit['period_label']}.",
            $computed['rows'] === [] => 'No shareholder holds shares in the share register to receive a dividend.',
            default => null,
        };

        return [
            'period' => $profit['period'],
            'period_label' => $profit['period_label'],
            'profit_available' => $profit['profit_available'],
            'profit_source' => $profit['source'],
            'period_closed' => $profit['period_closed'],
            'period_profit' => $profit['period_profit'],
            'profit_account_balance' => $profit['profit_account_balance'],
            'profit_note' => $profit['note'],
            'dividend_percent' => (float) $settings['dividend_percent'],
            'reinvest_percent' => (float) $settings['reinvest_percent'],
            'dividend_pool' => DividendMath::centsToFloat($computed['pool']),
            'reinvestment_amount' => DividendMath::centsToFloat($computed['reinvest']),
            'total_shares' => $computed['total_shares'],
            'as_of_date' => $asOf->toDateString(),
            'declaration_id' => $existing === null ? null : (int) $existing,
            'already_declared' => $existing !== null,
            'can_declare' => $blocking === null,
            'blocking_reason' => $blocking,
            'rows' => array_map(fn (array $row): array => [
                'share_holder_id' => $row['share_holder']->id,
                'name' => $row['share_holder']->full_name,
                'shares' => $row['shares'],
                'total_shares' => $row['total_shares'],
                'ownership_percent' => $row['percent'],
                'entitlement' => DividendMath::centsToFloat($row['entitlement']),
                'contribution_total' => $row['capital'],
            ], $computed['rows']),
        ];
    }

    /**
     * Declare the period's dividend. Profit, percentages and ownership are all re-read inside the transaction (the
     * company row is locked so two declarations cannot run at once).
     *
     * @throws ValidationException
     */
    public function declare(int $companyId, CarbonImmutable $period, Employee $employee): DividendDeclaration
    {
        $period = $period->startOfMonth();

        try {
            return DB::transaction(function () use ($companyId, $period, $employee): DividendDeclaration {
                Company::query()->whereKey($companyId)->lockForUpdate()->firstOrFail();

                if (DividendDeclaration::where('company_id', $companyId)->whereDate('period', $period->toDateString())->exists()) {
                    throw ValidationException::withMessages(['period' => $this->alreadyDeclaredMessage($period)]);
                }

                $profit = $this->availableProfit($companyId, $period);
                if ($profit['profit_available'] <= 0) {
                    throw ValidationException::withMessages(['period' => "There is no profit available to distribute for {$profit['period_label']}."]);
                }

                $settings = $this->settings($companyId);
                $asOf = CarbonImmutable::today();
                $computed = $this->compute($companyId, $profit['profit_available'], $settings['dividend_percent'], $asOf);
                if ($computed['rows'] === []) {
                    throw ValidationException::withMessages(['period' => 'No shareholder holds shares in the share register to receive a dividend.']);
                }

                $profitAmount = DividendMath::fromCents($computed['profit']);
                $pool = DividendMath::fromCents($computed['pool']);
                $reinvest = DividendMath::fromCents($computed['reinvest']);

                $declaration = DividendDeclaration::create([
                    'company_id' => $companyId,
                    'period' => $period->toDateString(),
                    'profit_amount' => $profitAmount,
                    'dividend_percent' => $settings['dividend_percent'],
                    'dividend_amount' => $pool,
                    'reinvest_percent' => $settings['reinvest_percent'],
                    'reinvest_amount' => $reinvest,
                    'total_shares' => $computed['total_shares'],
                    'as_of_date' => $asOf->toDateString(),
                    'profit_source' => $profit['source'],
                    'declared_by' => $employee->id,
                    'declared_at' => now(),
                ]);

                $entry = $this->ledger->journal($companyId, 'DIVIDEND DECLARATION '.$period->format('Y-m'), [
                    ['account' => Account::RetainedProfit, 'debit' => (float) $profitAmount],
                    ['account' => Account::Capital, 'credit' => (float) $reinvest],
                    ['account' => Account::DividendPayable, 'credit' => (float) $pool],
                ], $declaration, employee: $employee);

                $declaration->update(['journal_entry_id' => $entry->id]);

                foreach ($computed['rows'] as $row) {
                    $declaration->allocations()->create([
                        'company_id' => $companyId,
                        'share_holder_id' => $row['share_holder']->id,
                        'shares_held' => $row['shares'],
                        'total_shares' => $row['total_shares'],
                        'share_percent' => $row['percent'],
                        'contribution_total' => $row['capital'],
                        'amount' => DividendMath::fromCents($row['entitlement']),
                        'paid_amount' => 0,
                        'status' => DividendAllocation::STATUS_UNPAID,
                    ]);
                }

                return $declaration->load('allocations.shareHolder');
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['period' => $this->alreadyDeclaredMessage($period)]);
        }
    }

    /**
     * Pay all or part of a shareholder's remaining entitlement. A request carrying an idempotency key that was already
     * used returns the original payment instead of posting again.
     *
     * @return array{payment: DividendPayment, created: bool}
     *
     * @throws ValidationException
     */
    public function pay(
        DividendAllocation $allocation,
        string|float $amount,
        string $method,
        ?int $bankAccountId,
        ?string $reference,
        Employee $employee,
        ?string $idempotencyKey = null,
    ): array {
        $cents = DividendMath::toCents(is_float($amount) ? $amount : (string) $amount);
        if ($cents <= 0) {
            throw ValidationException::withMessages(['amount' => 'The amount to pay must be greater than zero.']);
        }

        $previous = $this->replayPayment($allocation, $cents, $idempotencyKey);
        if ($previous !== null) {
            return ['payment' => $previous, 'created' => false];
        }

        $source = $this->sourceAccount((int) $allocation->company_id, $method, $bankAccountId);

        try {
            $payment = DB::transaction(function () use ($allocation, $cents, $method, $source, $reference, $employee, $idempotencyKey): DividendPayment {
                /** @var DividendAllocation $locked */
                $locked = DividendAllocation::whereKey($allocation->id)->lockForUpdate()->firstOrFail();

                return $this->postPayment($locked, $cents, $method, $source, $reference, $employee, $idempotencyKey);
            });
        } catch (UniqueConstraintViolationException $exception) {
            $previous = $this->replayPayment($allocation, $cents, $idempotencyKey);
            if ($previous === null) {
                throw $exception;
            }

            return ['payment' => $previous, 'created' => false];
        }

        return ['payment' => $payment, 'created' => true];
    }

    /**
     * What PAY ALL OUTSTANDING would pay for a declaration right now: every allocation with a balance, its balance and
     * the total — read from the posted payments.
     *
     * @return array{declaration_id: int, period: string, period_label: string, shareholders: int, paid_shareholders: int, total_entitlement: float, total_paid: float, total_outstanding: float, rows: list<array{allocation_id: int, share_holder_id: int, share_holder: ?string, entitlement: float, paid_amount: float, balance: float}>}
     */
    public function payAllPreview(DividendDeclaration $declaration): array
    {
        $allocations = $declaration->allocations()->with('shareHolder')->orderBy('id')->get();

        return $this->outstandingSummary($declaration, $allocations);
    }

    /**
     * PAY ALL OUTSTANDING: in ONE transaction, lock the declaration and all its allocations (ordered by id), re-read each
     * paid total from the posted payments and pay exactly each remaining balance through the same posting path as
     * {@see pay()} (one payment row and one journal entry per shareholder), grouped in a batch. Fully paid allocations are
     * skipped. Any failure rolls the whole batch back. The client's expected total must match the server's total, but
     * the server-computed balances are what gets paid. A repeated idempotency key returns the original batch.
     *
     * @return array{batch: DividendPaymentBatch, created: bool}
     *
     * @throws ValidationException
     */
    public function payAll(
        DividendDeclaration $declaration,
        string|float|null $expectedTotal,
        string $method,
        ?int $bankAccountId,
        ?string $reference,
        Employee $employee,
        ?string $idempotencyKey = null,
    ): array {
        $previous = $this->replayBatch($declaration, $idempotencyKey);
        if ($previous !== null) {
            return ['batch' => $previous, 'created' => false];
        }

        $companyId = (int) $declaration->company_id;
        $source = $this->sourceAccount($companyId, $method, $bankAccountId);

        try {
            $batch = DB::transaction(function () use ($declaration, $companyId, $expectedTotal, $method, $source, $reference, $employee, $idempotencyKey): DividendPaymentBatch {
                /** @var DividendDeclaration $lockedDeclaration */
                $lockedDeclaration = DividendDeclaration::whereKey($declaration->id)->lockForUpdate()->firstOrFail();
                $allocations = DividendAllocation::where('dividend_declaration_id', $lockedDeclaration->id)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();
                $allocations->load('shareHolder');

                $summary = $this->outstandingSummary($lockedDeclaration, $allocations);
                $totalCents = DividendMath::toCents($summary['total_outstanding']);
                if ($totalCents <= 0) {
                    throw ValidationException::withMessages(['expected_total' => "All dividends for {$summary['period_label']} are already paid; there is no outstanding balance."]);
                }
                if ($expectedTotal === null || DividendMath::toCents(is_float($expectedTotal) ? $expectedTotal : (string) $expectedTotal) !== $totalCents) {
                    throw ValidationException::withMessages(['expected_total' => 'Outstanding balances changed — review and try again.']);
                }

                $total = DividendMath::centsToFloat($totalCents);
                $available = $this->ledger->balance($companyId, $source['account'], bankAccount: $source['bank'] ?? null);
                if ($available + 0.001 < $total) {
                    throw ValidationException::withMessages(['pay_method' => 'Insufficient balance in '.$source['label']]);
                }

                $batch = DividendPaymentBatch::create([
                    'company_id' => $companyId,
                    'dividend_declaration_id' => $lockedDeclaration->id,
                    'pay_method' => $method === 'BANK' ? 'BANK' : 'CASH',
                    'bank_account_id' => $source['bank'] ?? null,
                    'reference' => $reference,
                    'total_amount' => DividendMath::fromCents($totalCents),
                    'payments_count' => 0,
                    'idempotency_key' => $idempotencyKey,
                    'paid_by' => $employee->id,
                    'paid_at' => now(),
                ]);
                $batch->update(['batch_reference' => sprintf('DIVB-%s-%06d', $lockedDeclaration->period->format('Ym'), $batch->id)]);

                $balances = collect($summary['rows'])->keyBy('allocation_id');
                $count = 0;
                foreach ($allocations as $allocation) {
                    $balanceCents = DividendMath::toCents($balances[$allocation->id]['balance'] ?? 0);
                    if ($balanceCents <= 0) {
                        continue;
                    }
                    $allocation->setRelation('declaration', $lockedDeclaration);
                    $this->postPayment($allocation, $balanceCents, $method, $source, $reference, $employee, null, $batch->id);
                    $count++;
                }

                $batch->update(['payments_count' => $count]);

                return $batch;
            });
        } catch (UniqueConstraintViolationException $exception) {
            $previous = $this->replayBatch($declaration, $idempotencyKey);
            if ($previous === null) {
                throw $exception;
            }

            return ['batch' => $previous, 'created' => false];
        }

        return ['batch' => $batch, 'created' => true];
    }

    /**
     * Reverse a posted payment: opposite journal entry, payment marked reversed, entitlement balance restored.
     *
     * @throws ValidationException
     */
    public function reversePayment(DividendPayment $payment, string $reason, Employee $employee): DividendPayment
    {
        return DB::transaction(function () use ($payment, $reason, $employee): DividendPayment {
            $allocation = DividendAllocation::whereKey($payment->dividend_allocation_id)->lockForUpdate()->firstOrFail();
            /** @var DividendPayment $locked */
            $locked = DividendPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

            if (! $locked->isPosted()) {
                throw ValidationException::withMessages(['reason' => 'This dividend payment has already been reversed.']);
            }
            if ($locked->journalEntry === null) {
                throw ValidationException::withMessages(['reason' => 'This dividend payment has no journal entry to reverse.']);
            }

            $reversal = $this->ledger->reverse($locked->journalEntry, $reason);

            $locked->update([
                'status' => DividendPayment::STATUS_REVERSED,
                'reversal_journal_entry_id' => $reversal->id,
                'reversed_by' => $employee->id,
                'reversed_at' => now(),
                'reversal_reason' => $reason,
            ]);
            $this->refreshAllocation($allocation);

            return $locked;
        });
    }

    /**
     * Rewrite an allocation's paid amount and status from its posted payments.
     */
    public function refreshAllocation(DividendAllocation $allocation): DividendAllocation
    {
        $paid = $this->postedCents($allocation);
        $allocation->update([
            'paid_amount' => DividendMath::fromCents($paid),
            'status' => DividendAllocation::statusFor(DividendMath::toCents((string) $allocation->amount), $paid),
        ]);

        return $allocation;
    }

    /**
     * Sum of the allocation's posted (not reversed) payments, in cents, read from the payments table.
     */
    public function postedCents(DividendAllocation $allocation): int
    {
        $sum = DividendPayment::where('dividend_allocation_id', $allocation->id)
            ->where('status', DividendPayment::STATUS_POSTED)
            ->sum('amount');

        return DividendMath::toCents((string) $sum);
    }

    /**
     * Company totals: declared pools, posted payments and the outstanding balance.
     *
     * @return array{total_declared: float, total_paid: float, total_outstanding: float, dividend_balance: float, declarations: int}
     */
    public function totals(int $companyId): array
    {
        $declared = DividendMath::toCents((string) DividendDeclaration::where('company_id', $companyId)->sum('dividend_amount'));
        $paid = DividendMath::toCents((string) DividendPayment::where('company_id', $companyId)->where('status', DividendPayment::STATUS_POSTED)->sum('amount'));

        return [
            'total_declared' => DividendMath::centsToFloat($declared),
            'total_paid' => DividendMath::centsToFloat($paid),
            'total_outstanding' => DividendMath::centsToFloat($declared - $paid),
            'dividend_balance' => $this->dividendBalance($companyId),
            'declarations' => DividendDeclaration::where('company_id', $companyId)->count(),
        ];
    }

    public function alreadyDeclaredMessage(CarbonImmutable $period): string
    {
        return 'Dividends for '.$period->format('F Y').' have already been declared.';
    }

    /**
     * COMPANY ACCOUNT for CASH; for BANK a bank account of the same company is required.
     *
     * @return array{account: Account, bank?: int, label: string}
     */
    private function sourceAccount(int $companyId, string $method, ?int $bankAccountId): array
    {
        if ($method !== 'BANK') {
            return ['account' => Account::Company, 'label' => Account::Company->label()];
        }

        $bank = $bankAccountId === null ? null : BankAccount::where('company_id', $companyId)->find($bankAccountId);
        if ($bank === null) {
            throw ValidationException::withMessages(['bank_account_id' => 'Select the company bank account to pay from.']);
        }

        return ['account' => Account::Bank, 'bank' => $bank->id, 'label' => $bank->name];
    }

    /**
     * Post one payment of a LOCKED allocation (the caller holds the row lock inside a transaction): re-check the balance
     * from the posted payments, check the source balance, write the payment row and its journal entry (Dr DIVIDEND
     * ACCOUNT / Cr COMPANY ACCOUNT or bank), then rewrite the allocation's paid amount and status.
     *
     * @param  array{account: Account, bank?: int, label: string}  $source
     *
     * @throws ValidationException
     */
    private function postPayment(
        DividendAllocation $locked,
        int $cents,
        string $method,
        array $source,
        ?string $reference,
        Employee $employee,
        ?string $idempotencyKey,
        ?int $batchId = null,
    ): DividendPayment {
        $locked->loadMissing('shareHolder', 'declaration');

        $entitlement = DividendMath::toCents((string) $locked->amount);
        $remaining = $entitlement - $this->postedCents($locked);
        if ($remaining <= 0) {
            throw ValidationException::withMessages(['amount' => 'This dividend entitlement is already fully paid.']);
        }
        if ($cents > $remaining) {
            throw ValidationException::withMessages(['amount' => 'The amount to pay cannot exceed the outstanding balance of TZS '.number_format(DividendMath::centsToFloat($remaining), 2).'.']);
        }

        $amount = DividendMath::centsToFloat($cents);
        $balance = $this->ledger->balance($locked->company_id, $source['account'], bankAccount: $source['bank'] ?? null);
        if ($balance + 0.001 < $amount) {
            throw ValidationException::withMessages(['pay_method' => 'Insufficient balance in '.$source['label']]);
        }

        $payment = DividendPayment::create([
            'company_id' => $locked->company_id,
            'dividend_allocation_id' => $locked->id,
            'share_holder_id' => $locked->share_holder_id,
            'dividend_payment_batch_id' => $batchId,
            'amount' => DividendMath::fromCents($cents),
            'pay_method' => $method === 'BANK' ? 'BANK' : 'CASH',
            'source_account' => $source['account']->value,
            'bank_account_id' => $source['bank'] ?? null,
            'reference' => $reference,
            'paid_at' => now(),
            'paid_by' => $employee->id,
            'idempotency_key' => $idempotencyKey,
            'status' => DividendPayment::STATUS_POSTED,
        ]);

        $entry = $this->ledger->journal($locked->company_id, 'DIVIDEND PAYMENT '.$locked->declaration->period->format('Y-m').' - '.$locked->shareHolder->full_name, [
            ['account' => Account::DividendPayable, 'debit' => $amount],
            ['account' => $source['account'], 'bank' => $source['bank'] ?? null, 'credit' => $amount],
        ], $payment, employee: $employee);

        $payment->update(['journal_entry_id' => $entry->id]);
        $this->refreshAllocation($locked);

        return $payment;
    }

    /**
     * Entitlement, posted payments and balance of each allocation (one grouped query on the payments table) and the
     * declaration totals.
     *
     * @param  Collection<int, DividendAllocation>  $allocations
     * @return array{declaration_id: int, period: string, period_label: string, shareholders: int, paid_shareholders: int, total_entitlement: float, total_paid: float, total_outstanding: float, rows: list<array{allocation_id: int, share_holder_id: int, share_holder: ?string, entitlement: float, paid_amount: float, balance: float}>}
     */
    private function outstandingSummary(DividendDeclaration $declaration, Collection $allocations): array
    {
        $posted = $this->postedCentsByAllocation($allocations->pluck('id')->all());
        $rows = [];
        $entitlementTotal = 0;
        $paidTotal = 0;
        $outstandingTotal = 0;
        $paidShareholders = 0;

        foreach ($allocations as $allocation) {
            $entitlement = DividendMath::toCents((string) $allocation->amount);
            $paid = $posted[$allocation->id] ?? 0;
            $balance = max(0, $entitlement - $paid);
            $entitlementTotal += $entitlement;
            $paidTotal += $paid;
            if ($balance <= 0) {
                $paidShareholders++;

                continue;
            }
            $outstandingTotal += $balance;
            $rows[] = [
                'allocation_id' => $allocation->id,
                'share_holder_id' => (int) $allocation->share_holder_id,
                'share_holder' => $allocation->shareHolder?->full_name,
                'entitlement' => DividendMath::centsToFloat($entitlement),
                'paid_amount' => DividendMath::centsToFloat($paid),
                'balance' => DividendMath::centsToFloat($balance),
            ];
        }

        return [
            'declaration_id' => $declaration->id,
            'period' => $declaration->period->format('Y-m'),
            'period_label' => $declaration->periodLabel(),
            'shareholders' => count($rows),
            'paid_shareholders' => $paidShareholders,
            'total_entitlement' => DividendMath::centsToFloat($entitlementTotal),
            'total_paid' => DividendMath::centsToFloat($paidTotal),
            'total_outstanding' => DividendMath::centsToFloat($outstandingTotal),
            'rows' => $rows,
        ];
    }

    /**
     * Posted (not reversed) payment totals in cents, keyed by allocation id.
     *
     * @param  list<int>  $allocationIds
     * @return array<int, int>
     */
    public function postedCentsByAllocation(array $allocationIds): array
    {
        if ($allocationIds === []) {
            return [];
        }

        return DividendPayment::whereIn('dividend_allocation_id', $allocationIds)
            ->where('status', DividendPayment::STATUS_POSTED)
            ->groupBy('dividend_allocation_id')
            ->selectRaw('dividend_allocation_id, SUM(amount) as total')
            ->pluck('total', 'dividend_allocation_id')
            ->map(fn ($total): int => DividendMath::toCents((string) $total))
            ->all();
    }

    /**
     * The batch already recorded under this idempotency key, if any.
     */
    private function replayBatch(DividendDeclaration $declaration, ?string $idempotencyKey): ?DividendPaymentBatch
    {
        if ($idempotencyKey === null || $idempotencyKey === '') {
            return null;
        }

        $previous = DividendPaymentBatch::where('idempotency_key', $idempotencyKey)->first();
        if ($previous === null) {
            return null;
        }

        if ((int) $previous->dividend_declaration_id !== (int) $declaration->id) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different dividend batch.']);
        }

        return $previous;
    }

    /**
     * The payment already recorded under this idempotency key, if any.
     */
    private function replayPayment(DividendAllocation $allocation, int $cents, ?string $idempotencyKey): ?DividendPayment
    {
        if ($idempotencyKey === null || $idempotencyKey === '') {
            return null;
        }

        $previous = DividendPayment::where('idempotency_key', $idempotencyKey)->first();
        if ($previous === null) {
            return null;
        }

        if ((int) $previous->dividend_allocation_id !== (int) $allocation->id || DividendMath::toCents((string) $previous->amount) !== $cents) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different dividend payment.']);
        }

        return $previous;
    }

    /**
     * Profit split and entitlements in cents for a profit figure, a shareholder percentage and an ownership date.
     *
     * @return array{profit: int, pool: int, reinvest: int, total_shares: int, rows: list<array{share_holder: ShareHolder, capital: float, shares: int, total_shares: int, percent: float, entitlement: int}>}
     */
    private function compute(int $companyId, float $profit, string $dividendPercent, CarbonImmutable $asOf): array
    {
        $profitCents = max(0, DividendMath::toCents($profit));
        $split = DividendMath::split($profitCents, DividendMath::percentToBasis($dividendPercent));

        $holders = $this->shares($companyId, $asOf)->filter(fn (array $share): bool => $share['shares'] > 0)->values();
        $totalShares = (int) $holders->sum('shares');
        $entitlements = DividendMath::allocate($split['pool'], $holders->mapWithKeys(fn (array $share): array => [$share['share_holder']->id => $share['shares']])->all(), $totalShares);

        return [
            'profit' => $profitCents,
            'pool' => $split['pool'],
            'reinvest' => $split['reinvest'],
            'total_shares' => $totalShares,
            'rows' => $holders->map(fn (array $share): array => $share + ['entitlement' => $entitlements[$share['share_holder']->id] ?? 0])->all(),
        ];
    }
}
