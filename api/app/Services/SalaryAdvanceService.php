<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceCategory;
use App\Models\SalaryAdvancePayment;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Customer salary advance (live "perifelar" loans): request → approve → repayment → done.
 *
 * Ledger:
 *  - approval: Dr Salary Advance Receivable (branch) / Cr HQ Salary Advance account, and the category
 *    charge Dr Loan Fee (branch) / Cr Fee Income;
 *  - repayment: Dr HQ Salary Advance / Cr Receivable (principal) / Cr Interest Income (interest);
 *  - removal of an approved advance: reversal of every entry above (Documents: no delete, reversal only).
 */
class SalaryAdvanceService
{
    public function __construct(private readonly Ledger $ledger) {}

    public function request(Customer $customer, SalaryAdvanceCategory $category, float $amount, ?Employee $employee = null): SalaryAdvance
    {
        if ($amount < (float) $category->amount_from || $amount > (float) $category->amount_to) {
            throw ValidationException::withMessages([
                'loan_amount' => 'Loan amount must be between '.money($category->amount_from).' - '.money($category->amount_to),
            ]);
        }

        return SalaryAdvance::create([
            'company_id' => $customer->company_id,
            'branch_id' => $customer->branch_id,
            'customer_id' => $customer->id,
            'employee_id' => $employee?->id,
            'salary_advance_category_id' => $category->id,
            'amount' => $amount,
            'interest_rate' => $category->interest_rate,
            'total_payable' => round($amount * (1 + (float) $category->interest_rate / 100), 2),
            'fee' => $category->fee,
            'status' => 'pending',
        ]);
    }

    public function approve(SalaryAdvance $advance): void
    {
        DB::transaction(function () use ($advance): void {
            $locked = SalaryAdvance::lockForUpdate()->findOrFail($advance->id);

            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['status' => 'Salary advance is already approved']);
            }

            $locked->update(['status' => 'active', 'approved_at' => now()]);

            $this->ledger->journal($locked->company_id, 'SALARY ADVANCE LOAN', [
                ['account' => Account::SalaryAdvanceReceivable, 'branch' => $locked->branch_id, 'debit' => (float) $locked->amount],
                ['account' => Account::HqSalaryAdvance, 'credit' => (float) $locked->amount],
                ['account' => Account::LoanFee, 'branch' => $locked->branch_id, 'debit' => (float) $locked->fee],
                ['account' => Account::FeeIncome, 'branch' => $locked->branch_id, 'credit' => (float) $locked->fee],
            ], $locked, null, $locked->branch_id);

            $advance->setRawAttributes($locked->getAttributes(), true);
        });
    }

    /**
     * Repayment of an active advance. The business rule "Principal → Penalty → Interest" is applied:
     * principal is recovered first, interest only after the principal is fully repaid (no penalty exists
     * on salary advances).
     */
    public function pay(SalaryAdvance $advance, float $amount, ?CarbonImmutable $date = null): SalaryAdvancePayment
    {
        $date ??= CarbonImmutable::today();

        return DB::transaction(function () use ($advance, $amount, $date): SalaryAdvancePayment {
            $locked = SalaryAdvance::lockForUpdate()->findOrFail($advance->id);

            if ($locked->status !== 'active') {
                throw ValidationException::withMessages(['amount' => 'Salary advance is not active']);
            }

            $paid = (float) $locked->payments()->sum('amount');
            $remaining = max(0, round((float) $locked->total_payable - $paid, 2));

            if ($amount > $remaining + 0.001) {
                throw ValidationException::withMessages(['amount' => 'Amount is greater than remain amount ('.money($remaining).')']);
            }

            $principal = round(min($amount, max(0, (float) $locked->amount - $paid)), 2);

            $payment = $locked->payments()->create(['amount' => $amount, 'paid_on' => $date->toDateString()]);

            $this->ledger->journal($locked->company_id, 'SALARY ADVANCE DEPOSIT', [
                ['account' => Account::HqSalaryAdvance, 'debit' => $amount],
                ['account' => Account::SalaryAdvanceReceivable, 'branch' => $locked->branch_id, 'credit' => $principal],
                ['account' => Account::InterestIncome, 'branch' => $locked->branch_id, 'credit' => round($amount - $principal, 2)],
            ], $payment, $date, $locked->branch_id);

            if ($amount >= $remaining - 0.001) {
                $locked->update(['status' => 'done']);
            }

            return $payment;
        });
    }

    /**
     * Remove a salary advance. A pending request has no money effect and is deleted; an approved
     * advance is kept and marked reversed, and its approval and repayment entries are reversed.
     */
    public function remove(SalaryAdvance $advance, ?string $reason, Employee $employee): void
    {
        if ($advance->reversed_at !== null) {
            throw ValidationException::withMessages(['status' => 'Salary advance is already reversed']);
        }

        if ($advance->status === 'pending') {
            $advance->delete();

            return;
        }

        if (blank($reason)) {
            throw ValidationException::withMessages(['reason' => 'Please enter the reason for reversal']);
        }

        DB::transaction(function () use ($advance, $reason, $employee): void {
            $entries = JournalEntry::query()
                ->whereNull('reversal_of_id')
                ->whereDoesntHave('reversal')
                ->where(function ($query) use ($advance): void {
                    $query->where(fn ($inner) => $inner->where('source_type', $advance->getMorphClass())->where('source_id', $advance->id))
                        ->orWhere(fn ($inner) => $inner->where('source_type', (new SalaryAdvancePayment)->getMorphClass())->whereIn('source_id', $advance->payments()->pluck('id')));
                })
                ->with('lines')
                ->get();

            foreach ($entries as $entry) {
                $this->ledger->reverse($entry, (string) $reason);
            }

            $advance->update([
                'status' => 'reversed',
                'reversed_at' => now(),
                'reversal_reason' => $reason,
                'reversed_by' => $employee->id,
            ]);
        });
    }
}
