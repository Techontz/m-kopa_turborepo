<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\Company;
use App\Models\Employee;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Internal company fund movements between the COMPANY ACCOUNT (company cash) and a company bank account, recorded
 * as `bank_transfers` rows (types company_to_bank / bank_to_company) and posted as ledger transfers:
 * Dr the receiving account, Cr the sending account. Company totals are unchanged; no balance is ever edited directly.
 */
class CompanyFunds
{
    public const CASH_TO_BANK = 'company_to_bank';

    public const BANK_TO_CASH = 'bank_to_company';

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * @return array{transfer: BankTransfer, created: bool}
     */
    public function transfer(int $companyId, string $type, int $bankAccountId, float $amount, Employee $employee, ?string $reference = null, ?string $idempotencyKey = null): array
    {
        $amount = round($amount, 2);
        if (! in_array($type, [self::CASH_TO_BANK, self::BANK_TO_CASH], true)) {
            throw ValidationException::withMessages(['direction' => 'Select a valid transfer direction']);
        }
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => 'Amount must be greater than zero']);
        }

        $previous = $this->replay($companyId, $type, $bankAccountId, $amount, $idempotencyKey);
        if ($previous !== null) {
            return ['transfer' => $previous, 'created' => false];
        }

        try {
            $transfer = DB::transaction(function () use ($companyId, $type, $bankAccountId, $amount, $employee, $reference, $idempotencyKey): BankTransfer {
                Company::whereKey($companyId)->lockForUpdate()->firstOrFail();
                $bank = BankAccount::where('company_id', $companyId)->whereKey($bankAccountId)->lockForUpdate()->first();
                if ($bank === null) {
                    throw ValidationException::withMessages(['bank_account_id' => 'Select a company bank account']);
                }

                $cash = ['account' => Account::Company];
                $bankLine = ['account' => Account::Bank, 'bank' => $bank->id];
                [$from, $to] = $type === self::CASH_TO_BANK ? [$cash, $bankLine] : [$bankLine, $cash];

                $available = $this->ledger->balance($companyId, $from['account'], bankAccount: $from['bank'] ?? null);
                if ($available < $amount) {
                    throw ValidationException::withMessages(['amount' => 'Insufficient balance in '.($type === self::CASH_TO_BANK ? Account::Company->label() : $bank->name)]);
                }

                $transfer = BankTransfer::create([
                    'company_id' => $companyId,
                    'type' => $type,
                    'bank_account_id' => $bank->id,
                    'employee_id' => $employee->id,
                    'amount' => $amount,
                    'reference' => $reference,
                    'status' => 'approved',
                    'transfer_date' => today(),
                    'idempotency_key' => $idempotencyKey,
                ]);

                $entry = $this->ledger->transfer(
                    $companyId,
                    $from,
                    $to,
                    $amount,
                    $type === self::CASH_TO_BANK ? 'COMPANY CASH TO BANK - '.$bank->name : 'BANK TO COMPANY CASH - '.$bank->name,
                    $transfer,
                );

                $transfer->update(['journal_entry_id' => $entry->id]);

                return $transfer;
            });
        } catch (UniqueConstraintViolationException $exception) {
            $previous = $this->replay($companyId, $type, $bankAccountId, $amount, $idempotencyKey);
            if ($previous === null) {
                throw $exception;
            }

            return ['transfer' => $previous, 'created' => false];
        }

        return ['transfer' => $transfer, 'created' => true];
    }

    private function replay(int $companyId, string $type, int $bankAccountId, float $amount, ?string $idempotencyKey): ?BankTransfer
    {
        if ($idempotencyKey === null) {
            return null;
        }

        $previous = BankTransfer::where('idempotency_key', $idempotencyKey)->first();
        if ($previous === null) {
            return null;
        }

        if ((int) $previous->company_id !== $companyId || $previous->type !== $type || (int) $previous->bank_account_id !== $bankAccountId || abs((float) $previous->amount - $amount) > 0.001) {
            throw ValidationException::withMessages(['idempotency_key' => 'This request key was already used for a different transfer']);
        }

        return $previous;
    }
}
