<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\AgentTransaction;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\PaymentMode;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Agent ("Clientless transaction") money. Money received through an agent line is held on the branch
 * Agent account against Suspense until it is matched: Dr Agent (branch) / Cr Suspense (branch).
 */
class AgentTransactionService
{
    public function __construct(private readonly Ledger $ledger) {}

    /**
     * @param  array{branch_id: int, payment_mode_id: int, agent: string, amount: float, date: string, time: string}  $data
     */
    public function record(int $companyId, array $data, ?Employee $employee = null): AgentTransaction
    {
        return DB::transaction(function () use ($companyId, $data, $employee): AgentTransaction {
            $transaction = AgentTransaction::create([
                'company_id' => $companyId,
                'branch_id' => $data['branch_id'],
                'payment_mode_id' => PaymentMode::where('company_id', $companyId)->findOrFail($data['payment_mode_id'])->id,
                'employee_id' => $employee?->id,
                'agent' => $data['agent'],
                'amount' => $data['amount'],
                'transaction_date' => $data['date'],
                'transaction_time' => $data['time'],
            ]);

            $this->post($transaction, 'CLIENTLESS TRANSACTION');

            return $transaction;
        });
    }

    /**
     * Customer deposit received through an agent (listed on "Deposit transaction").
     * Cross-module hook for the teller/payments module.
     */
    public function customerDeposit(Customer $customer, float $amount, float $loanAmount, ?Employee $employee = null, ?CarbonImmutable $date = null): AgentTransaction
    {
        return DB::transaction(function () use ($customer, $amount, $loanAmount, $employee, $date): AgentTransaction {
            $transaction = AgentTransaction::create([
                'company_id' => $customer->company_id,
                'branch_id' => $customer->branch_id,
                'customer_id' => $customer->id,
                'employee_id' => $employee?->id,
                'amount' => $amount,
                'loan_amount' => $loanAmount,
                'transaction_date' => ($date ?? CarbonImmutable::today())->toDateString(),
                'transaction_time' => now()->format('H:i:s'),
            ]);

            $this->post($transaction, 'AGENT DEPOSIT');

            return $transaction;
        });
    }

    public function reverse(AgentTransaction $transaction, string $reason, Employee $employee): void
    {
        if ($transaction->reversed_at !== null) {
            throw ValidationException::withMessages(['reason' => 'Transaction is already reversed']);
        }

        DB::transaction(function () use ($transaction, $reason, $employee): void {
            JournalEntry::query()
                ->where('source_type', $transaction->getMorphClass())
                ->where('source_id', $transaction->id)
                ->whereNull('reversal_of_id')
                ->whereDoesntHave('reversal')
                ->with('lines')
                ->get()
                ->each(fn (JournalEntry $entry) => $this->ledger->reverse($entry, $reason));

            $transaction->update(['reversed_at' => now(), 'reversal_reason' => $reason, 'reversed_by' => $employee->id]);
        });
    }

    private function post(AgentTransaction $transaction, string $description): void
    {
        $this->ledger->transfer(
            $transaction->company_id,
            ['account' => Account::Suspense, 'branch' => $transaction->branch_id],
            ['account' => Account::Agent, 'branch' => $transaction->branch_id],
            (float) $transaction->amount,
            $description,
            $transaction,
            date: CarbonImmutable::parse($transaction->transaction_date),
        );
    }
}
