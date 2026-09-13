<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\FloatTransfer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Float movements (live Capital → Float pages). Every movement is posted through the ledger.
 */
class FloatService
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Company account → branch principal account (approved immediately, as on the live page).
     *
     * Inferred: the company account must hold enough balance for the float.
     */
    public function companyToBranch(int $companyId, int $branchId, float $amount): FloatTransfer
    {
        $this->ensureBalance($companyId, Account::Company, null, $amount, 'blanch_amount');

        return DB::transaction(function () use ($companyId, $branchId, $amount): FloatTransfer {
            $transfer = FloatTransfer::create([
                'company_id' => $companyId,
                'type' => 'company_to_branch',
                'to_branch_id' => $branchId,
                'from_account' => Account::Company->value,
                'to_account' => Account::Principal->value,
                'amount' => $amount,
                'status' => 'approved',
                'transfer_date' => today(),
            ]);

            $this->ledger->transfer($companyId, ['account' => Account::Company], ['account' => Account::Principal, 'branch' => $branchId], $amount, 'FLOAT FROM COMPANY ACCOUNT', $transfer);

            return $transfer;
        });
    }

    public function requestBranchToBranch(int $companyId, int $fromBranchId, int $toBranchId, float $amount): FloatTransfer
    {
        return FloatTransfer::create([
            'company_id' => $companyId,
            'type' => 'branch_to_branch',
            'from_branch_id' => $fromBranchId,
            'to_branch_id' => $toBranchId,
            'from_account' => Account::Principal->value,
            'to_account' => Account::Principal->value,
            'amount' => $amount,
            'status' => 'pending',
            'transfer_date' => today(),
        ]);
    }

    /**
     * Inferred: approval moves the float from the sending branch's principal account to the receiving
     * branch's principal account, provided the sender has enough balance.
     */
    public function approve(FloatTransfer $transfer): FloatTransfer
    {
        if ($transfer->type !== 'branch_to_branch' || $transfer->status !== 'pending') {
            throw ValidationException::withMessages(['transfer' => 'Transaction is already processed']);
        }

        $amount = (float) $transfer->amount;
        $this->ensureBalance($transfer->company_id, Account::Principal, $transfer->from_branch_id, $amount, 'transfer');

        return DB::transaction(function () use ($transfer, $amount): FloatTransfer {
            $locked = FloatTransfer::whereKey($transfer->id)->lockForUpdate()->first();
            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['transfer' => 'Transaction is already processed']);
            }

            $this->ledger->transfer(
                $transfer->company_id,
                ['account' => Account::Principal, 'branch' => $transfer->from_branch_id],
                ['account' => Account::Principal, 'branch' => $transfer->to_branch_id],
                $amount,
                'FLOAT BRANCH TO BRANCH',
                $transfer,
            );

            $transfer->update(['status' => 'approved', 'transfer_date' => today()]);

            return $transfer;
        });
    }

    /**
     * PRINCIPAL ↔ INTEREST within one branch. Recorded as an approved float transfer so the movement has a source.
     */
    public function accountToAccount(int $companyId, int $branchId, Account $from, Account $to, float $amount): FloatTransfer
    {
        $this->ensureBalance($companyId, $from, $branchId, $amount, 'amount');

        return DB::transaction(function () use ($companyId, $branchId, $from, $to, $amount): FloatTransfer {
            $transfer = FloatTransfer::create([
                'company_id' => $companyId,
                'type' => 'account_to_account',
                'from_branch_id' => $branchId,
                'to_branch_id' => $branchId,
                'from_account' => $from->value,
                'to_account' => $to->value,
                'amount' => $amount,
                'status' => 'approved',
                'transfer_date' => today(),
            ]);

            $this->ledger->transfer($companyId, ['account' => $from, 'branch' => $branchId], ['account' => $to, 'branch' => $branchId], $amount, 'FLOAT '.$from->label().' TO '.$to->label(), $transfer);

            return $transfer;
        });
    }

    private function ensureBalance(int $companyId, Account $account, ?int $branchId, float $amount, string $field): void
    {
        if ($this->ledger->balance($companyId, $account, $branchId) < $amount) {
            throw ValidationException::withMessages([$field => 'Insufficient balance in '.$account->label()]);
        }
    }
}
