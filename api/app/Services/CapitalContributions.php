<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Capital;
use App\Models\Employee;
use App\Models\ShareHolder;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records shareholder capital contributions (Capital → Add Capitals, and paid share issuances from Shares → Issue
 * Shares, which link the share transaction to the contribution this service records).
 *
 * Each contribution is its own `capitals` row and one balanced journal entry:
 *   Dr the company account that received the money — COMPANY ACCOUNT for CASH, the selected bank account for BANK —
 *   Cr CAPITAL ACCOUNT (equity; never revenue).
 * Row and entry are written in one database transaction. A request carrying an idempotency key that was already
 * recorded returns the original contribution instead of posting again.
 */
class CapitalContributions
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * @param  Closure(Capital): void|null  $afterCreate  runs inside the transaction for a new contribution (e.g. storing the receipt file)
     * @param  string|null  $description  journal description (defaults to "CAPITAL CONTRIBUTION - <shareholder>")
     * @return array{capital: Capital, created: bool}
     */
    public function contribute(
        ShareHolder $holder,
        float $amount,
        string $payMethod,
        ?int $bankAccountId,
        Employee $recordedBy,
        ?string $receiptNumber = null,
        ?string $chequeNumber = null,
        ?CarbonImmutable $contributedAt = null,
        ?string $idempotencyKey = null,
        ?Closure $afterCreate = null,
        ?string $description = null,
    ): array {
        $amount = round($amount, 2);
        $contributedAt ??= CarbonImmutable::now();

        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Amount must be greater than zero']);
        }

        $previous = $this->replay($holder, $amount, $idempotencyKey);
        if ($previous !== null) {
            return ['capital' => $previous, 'created' => false];
        }

        $receiving = $this->receivingAccount((int) $holder->company_id, $payMethod, $bankAccountId);

        return $this->record($holder, $amount, $payMethod, $receiving, $recordedBy, $receiptNumber, $chequeNumber, $contributedAt, $idempotencyKey, $afterCreate, $description);
    }

    /**
     * An asset contributed as capital: one `capitals` row (pay method ASSET, receiving account = the fixed-asset account)
     * and one balanced journal Dr the fixed-asset account / Cr CAPITAL ACCOUNT — cash and bank never move. The asset row
     * itself is written by `$afterCreate` inside the same transaction.
     *
     * @param  Closure(Capital): void  $afterCreate
     * @return array{capital: Capital, created: bool}
     */
    public function contributeAsset(
        ShareHolder $holder,
        float $amount,
        Account $assetAccount,
        Employee $recordedBy,
        CarbonImmutable $contributedAt,
        ?string $idempotencyKey,
        Closure $afterCreate,
        string $description,
    ): array {
        $amount = round($amount, 2);

        if ($amount <= 0) {
            throw ValidationException::withMessages(['unit_value' => 'The contribution value must be greater than zero']);
        }
        if (! in_array($assetAccount, Account::fixedAssets(), true)) {
            throw ValidationException::withMessages(['asset_type' => 'An asset contribution must be posted to a fixed-asset account']);
        }

        $previous = $this->replay($holder, $amount, $idempotencyKey);
        if ($previous !== null) {
            return ['capital' => $previous, 'created' => false];
        }

        return $this->record($holder, $amount, 'ASSET', ['account' => $assetAccount], $recordedBy, null, null, $contributedAt, $idempotencyKey, $afterCreate, $description);
    }

    /**
     * @param  array{account: Account, bank?: int}  $receiving
     * @return array{capital: Capital, created: bool}
     */
    private function record(
        ShareHolder $holder,
        float $amount,
        string $payMethod,
        array $receiving,
        Employee $recordedBy,
        ?string $receiptNumber,
        ?string $chequeNumber,
        CarbonImmutable $contributedAt,
        ?string $idempotencyKey,
        ?Closure $afterCreate,
        ?string $description,
    ): array {
        try {
            $capital = DB::transaction(function () use ($holder, $amount, $payMethod, $receiving, $recordedBy, $receiptNumber, $chequeNumber, $contributedAt, $idempotencyKey, $afterCreate, $description): Capital {
                $capital = Capital::create([
                    'company_id' => $holder->company_id,
                    'share_holder_id' => $holder->id,
                    'amount' => $amount,
                    'pay_method' => $payMethod,
                    'receiving_account' => $receiving['account']->value,
                    'bank_account_id' => $receiving['bank'] ?? null,
                    'receipt_number' => $receiptNumber,
                    'cheque_number' => $chequeNumber,
                    'recorded_by' => $recordedBy->id,
                    'contributed_at' => $contributedAt,
                    'idempotency_key' => $idempotencyKey,
                ]);

                $entry = $this->ledger->journal($holder->company_id, $description ?? 'CAPITAL CONTRIBUTION - '.$holder->full_name, [
                    $receiving + ['debit' => $amount],
                    ['account' => Account::Capital, 'credit' => $amount],
                ], $capital, $contributedAt, employee: $recordedBy);

                $capital->update(['journal_entry_id' => $entry->id]);

                if ($afterCreate !== null) {
                    $afterCreate($capital);
                }

                return $capital;
            });
        } catch (UniqueConstraintViolationException $exception) {
            $previous = $this->replay($holder, $amount, $idempotencyKey);
            if ($previous === null) {
                throw $exception;
            }

            return ['capital' => $previous, 'created' => false];
        }

        return ['capital' => $capital, 'created' => true];
    }

    /**
     * COMPANY ACCOUNT for CASH; for BANK a bank account of the same company is required.
     *
     * @return array{account: Account, bank?: int}
     */
    public function receivingAccount(int $companyId, string $payMethod, ?int $bankAccountId): array
    {
        if ($payMethod !== 'BANK') {
            return ['account' => Account::Company];
        }

        $bank = $bankAccountId === null ? null : BankAccount::where('company_id', $companyId)->find($bankAccountId);
        if ($bank === null) {
            throw ValidationException::withMessages(['bank_account_id' => 'Select the company bank account that received the money']);
        }

        return ['account' => Account::Bank, 'bank' => $bank->id];
    }

    /**
     * The contribution already recorded under this idempotency key, if any.
     */
    private function replay(ShareHolder $holder, float $amount, ?string $idempotencyKey): ?Capital
    {
        if ($idempotencyKey === null) {
            return null;
        }

        $previous = Capital::where('idempotency_key', $idempotencyKey)->first();
        if ($previous === null) {
            return null;
        }

        if ((int) $previous->company_id !== (int) $holder->company_id || (int) $previous->share_holder_id !== (int) $holder->id || abs((float) $previous->amount - $amount) > 0.001) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different contribution']);
        }

        return $previous;
    }
}
