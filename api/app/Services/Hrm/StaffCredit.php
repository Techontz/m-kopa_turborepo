<?php

namespace App\Services\Hrm;

use App\Enums\Account;
use App\Models\ApprovalPolicy;
use App\Models\Employee;
use App\Models\StaffLoan;
use App\Models\StaffLoanPayment;
use App\Models\StaffSalaryAdvance;
use App\Services\Approvals\SegregationOfDuties;
use App\Services\Ledger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Staff loans and staff salary advances (STAFF COMMISSION §13–14, §16 "Malipo yote HR
 * ata-approval, disbursement zote zitafanyika finance").
 *
 * Workflow: request (HR) → approve (HR) → disburse (Finance, money leaves the Staff Fund)
 * → recovery from salary (payroll) or cash repayment into the fund.
 *
 * Rule 6 (segregation of duties): the approver is neither the employee who requested the credit nor its beneficiary;
 * the payer (disbursement) is none of the requester, the approver and the beneficiary — unless self-approval is
 * explicitly granted ({@see SegregationOfDuties}). Legacy rows without a recorded requester skip that part.
 */
class StaffCredit
{
    public function __construct(
        private readonly Ledger $ledger,
        private readonly StaffFund $fund,
        private readonly SegregationOfDuties $duties,
    ) {}

    /**
     * Live rule: the full amount applied is approved; Loan + interest = amount × (1 + rate%),
     * restoration = total ÷ number of repayments.
     */
    public function approveLoan(StaffLoan $loan, Employee $approver): void
    {
        $this->assertStatus($loan->status, 'pending', 'Loan is not pending');
        $this->duties->assertCanApprove([$loan->requested_by, $loan->employee_id], $approver, 'staff loan', workflow: ApprovalPolicy::STAFF_CREDIT);

        $loan->loadMissing('category');
        $amount = (float) $loan->amount_applied;
        $total = round($amount * (1 + (float) $loan->category->interest_rate / 100), 2);

        $loan->update([
            'amount_approved' => $amount,
            'total_payable' => $total,
            'restoration' => round($total / max(1, $loan->sessions), 2),
            'fee' => $loan->category->fee,
            'status' => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);
    }

    public function rejectLoan(StaffLoan $loan): void
    {
        if (! in_array($loan->status, ['pending', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Loan can not be rejected']);
        }

        $loan->update(['status' => 'rejected']);
    }

    /**
     * Dr Staff Loan (principal) / Cr Staff Fund A/C (principal − fee) / Cr Staff Fund (fee, inferred: the
     * category charge is kept by the fund).
     */
    public function disburseLoan(StaffLoan $loan, Employee $payer): void
    {
        $this->assertStatus($loan->status, 'approved', 'Loan is not approved');
        $this->duties->assertCanApprove([$loan->requested_by, $loan->employee_id], $payer, 'staff loan disbursement', workflow: ApprovalPolicy::STAFF_CREDIT);
        $this->duties->assertCanApprove($loan->approved_by, $payer, 'staff loan disbursement', SegregationOfDuties::STAGE_MESSAGE, workflow: ApprovalPolicy::STAFF_CREDIT);

        $principal = (float) $loan->amount_approved;
        $fee = min((float) $loan->fee, $principal);
        $this->fund->assertAvailable((int) $loan->company_id, $principal - $fee);

        DB::transaction(function () use ($loan, $payer, $principal, $fee): void {
            $loan->update(['status' => 'active', 'disbursed_by' => $payer->id, 'disbursed_at' => now()]);
            $loan->loadMissing('employee');

            $this->ledger->journal($loan->company_id, "Staff loan - {$loan->employee->full_name}", [
                ['account' => Account::StaffLoanReceivable, 'employee' => $loan->employee_id, 'debit' => $principal],
                ['account' => Account::StaffFundCash, 'credit' => $principal - $fee],
                ['account' => Account::StaffFund, 'credit' => $fee],
            ], $loan, employee: $payer);
        });
    }

    /**
     * Cash repayment ("Deposit") into the Staff Fund A/C: principal share reduces the loan, interest share is fund income.
     */
    public function repayLoan(StaffLoan $loan, float $amount, Employee $recorder): StaffLoanPayment
    {
        $this->assertStatus($loan->status, 'active', 'Loan is not active');

        if ($amount > $loan->remainingAmount() + 0.001) {
            throw ValidationException::withMessages(['amount' => 'Amount is more than the remaining loan of '.number_format($loan->remainingAmount())]);
        }

        return DB::transaction(function () use ($loan, $amount, $recorder): StaffLoanPayment {
            $payment = $this->recordLoanPayment($loan, $amount);
            [$principal, $interest] = $this->splitLoanPayment($loan, $amount);

            $this->ledger->journal($loan->company_id, 'Staff loan repayment', [
                ['account' => Account::StaffFundCash, 'debit' => $amount],
                ['account' => Account::StaffLoanReceivable, 'employee' => $loan->employee_id, 'credit' => $principal],
                ['account' => Account::StaffFund, 'credit' => $interest],
            ], $payment, employee: $recorder);

            return $payment;
        });
    }

    public function approveAdvance(StaffSalaryAdvance $advance, Employee $approver): void
    {
        $this->assertStatus($advance->status, 'pending', 'Salary advance is not pending');
        $this->duties->assertCanApprove([$advance->requested_by, $advance->employee_id], $approver, 'staff salary advance', workflow: ApprovalPolicy::STAFF_CREDIT);

        $advance->update(['status' => 'approved', 'approved_by' => $approver->id, 'approved_at' => now()]);
    }

    public function rejectAdvance(StaffSalaryAdvance $advance): void
    {
        if (! in_array($advance->status, ['pending', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Salary advance can not be rejected']);
        }

        $advance->update(['status' => 'rejected']);
    }

    /**
     * Documents: "Dr Staff Advance Cr HQ Cash / Staff Fund". The category charge (fee) is withheld from
     * the amount paid out and kept by the fund (or HQ fee income when paid from the company account).
     */
    public function disburseAdvance(StaffSalaryAdvance $advance, Account $source, Employee $payer): void
    {
        $this->assertStatus($advance->status, 'approved', 'Salary advance is not approved');
        $this->duties->assertCanApprove([$advance->requested_by, $advance->employee_id], $payer, 'staff salary advance disbursement', workflow: ApprovalPolicy::STAFF_CREDIT);
        $this->duties->assertCanApprove($advance->approved_by, $payer, 'staff salary advance disbursement', SegregationOfDuties::STAGE_MESSAGE, workflow: ApprovalPolicy::STAFF_CREDIT);

        if (! in_array($source, [Account::StaffFundCash, Account::Company], true)) {
            throw ValidationException::withMessages(['source' => 'Invalid account']);
        }

        $amount = (float) $advance->amount;
        $fee = min((float) $advance->fee, $amount);

        if ($source === Account::StaffFundCash) {
            $this->fund->assertAvailable((int) $advance->company_id, $amount - $fee);
        }

        DB::transaction(function () use ($advance, $source, $payer, $amount, $fee): void {
            $advance->update(['status' => 'disbursed', 'source_account' => $source->value, 'disbursed_by' => $payer->id, 'disbursed_at' => now()]);
            $advance->loadMissing('employee');

            $this->ledger->journal($advance->company_id, "Staff salary advance - {$advance->employee->full_name}", [
                ['account' => Account::StaffAdvanceReceivable, 'employee' => $advance->employee_id, 'debit' => $amount],
                ['account' => $source, 'credit' => $amount - $fee],
                ['account' => $source === Account::StaffFundCash ? Account::StaffFund : Account::FeeIncome, 'credit' => $fee],
            ], $advance, employee: $payer);
        });
    }

    /**
     * Why the employee may not take the next approval step (approve a pending credit, disburse an approved one), or null.
     */
    public function stepBlockedReason(StaffLoan|StaffSalaryAdvance $credit, Employee $employee): ?string
    {
        return match ($credit->status) {
            'pending' => $this->duties->blockedReason([$credit->requested_by, $credit->employee_id], $employee, workflow: ApprovalPolicy::STAFF_CREDIT),
            'approved' => $this->duties->blockedReason([$credit->requested_by, $credit->employee_id], $employee, workflow: ApprovalPolicy::STAFF_CREDIT)
                ?? $this->duties->blockedReason($credit->approved_by, $employee, SegregationOfDuties::STAGE_MESSAGE, workflow: ApprovalPolicy::STAFF_CREDIT),
            default => null,
        };
    }

    public function recordLoanPayment(StaffLoan $loan, float $amount): StaffLoanPayment
    {
        $payment = $loan->payments()->create(['amount' => $amount, 'paid_on' => now()]);

        if ((float) $loan->total_payable - (float) $loan->payments()->sum('amount') <= 0.001) {
            $loan->update(['status' => 'done']);
        }

        return $payment;
    }

    /**
     * @return array{0: float, 1: float} principal share, interest share
     */
    public function splitLoanPayment(StaffLoan $loan, float $amount): array
    {
        $total = (float) $loan->total_payable;
        $principal = $total > 0 ? round($amount * (float) $loan->amount_approved / $total, 2) : $amount;

        return [$principal, round($amount - $principal, 2)];
    }

    private function assertStatus(string $actual, string $expected, string $message): void
    {
        if ($actual !== $expected) {
            throw ValidationException::withMessages(['status' => $message]);
        }
    }
}
