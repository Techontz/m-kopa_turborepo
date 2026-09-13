<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Company;
use App\Models\LedgerEntry;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for every account balance shown in the system.
 * Balances are never stored; they are the sum of signed ledger entries.
 */
class Ledger
{
    public function post(
        Company|int $company,
        Account $account,
        float $amount,
        string $description,
        Branch|int|null $branch = null,
        ?Model $reference = null,
        BankAccount|int|null $bankAccount = null,
        ?CarbonInterface $date = null,
    ): LedgerEntry {
        return LedgerEntry::create([
            'company_id' => $company instanceof Company ? $company->id : $company,
            'branch_id' => $branch instanceof Branch ? $branch->id : $branch,
            'bank_account_id' => $bankAccount instanceof BankAccount ? $bankAccount->id : $bankAccount,
            'account' => $account,
            'amount' => round($amount, 2),
            'description' => $description,
            'reference_type' => $reference?->getMorphClass(),
            'reference_id' => $reference?->getKey(),
            'entry_date' => ($date ?? now())->toDateString(),
        ]);
    }

    /**
     * Move money between two accounts atomically.
     *
     * @param  array{account: Account, branch?: Branch|int|null, bank?: BankAccount|int|null}  $from
     * @param  array{account: Account, branch?: Branch|int|null, bank?: BankAccount|int|null}  $to
     */
    public function transfer(Company|int $company, array $from, array $to, float $amount, string $description, ?Model $reference = null, float $charge = 0): void
    {
        DB::transaction(function () use ($company, $from, $to, $amount, $description, $reference, $charge): void {
            $this->post($company, $from['account'], -($amount + $charge), $description, $from['branch'] ?? null, $reference, $from['bank'] ?? null);
            $this->post($company, $to['account'], $amount, $description, $to['branch'] ?? null, $reference, $to['bank'] ?? null);
        });
    }

    public function balance(
        Company|int $company,
        Account $account,
        Branch|int|null $branch = null,
        BankAccount|int|null $bankAccount = null,
        ?CarbonInterface $until = null,
        bool $allBranches = false,
    ): float {
        $query = LedgerEntry::query()
            ->where('company_id', $company instanceof Company ? $company->id : $company)
            ->where('account', $account->value);

        if (! $allBranches) {
            $branchId = $branch instanceof Branch ? $branch->id : $branch;
            $branchId === null ? $query->whereNull('branch_id') : $query->where('branch_id', $branchId);
        }

        if ($bankAccount !== null) {
            $query->where('bank_account_id', $bankAccount instanceof BankAccount ? $bankAccount->id : $bankAccount);
        }

        if ($until !== null) {
            $query->whereDate('entry_date', '<=', $until->toDateString());
        }

        return (float) $query->sum('amount');
    }

    /**
     * Total movement (sum of positive or negative entries) for an account in a date range.
     */
    public function movement(Company|int $company, Account $account, CarbonInterface $from, CarbonInterface $to, bool $inflow = true, ?int $branchId = null): float
    {
        $query = LedgerEntry::query()
            ->where('company_id', $company instanceof Company ? $company->id : $company)
            ->where('account', $account->value)
            ->whereBetween('entry_date', [$from->toDateString(), $to->toDateString()])
            ->where('amount', $inflow ? '>' : '<', 0);

        if ($branchId !== null) {
            $query->where('branch_id', $branchId);
        }

        return abs((float) $query->sum('amount'));
    }
}
