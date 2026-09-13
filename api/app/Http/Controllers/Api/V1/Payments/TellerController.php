<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Enums\Account;
use App\Enums\LoanStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Payments\BankDepositRequest;
use App\Http\Requests\Api\Payments\TellerDepositRequest;
use App\Http\Resources\Api\V1\Payments\PaymentResource;
use App\Http\Resources\Api\V1\Payments\TellerDepositResource;
use App\Models\BankAccount;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanTransaction;
use App\Models\Payment;
use App\Models\Penalty;
use App\Models\TellerDeposit;
use App\Services\AccessControl;
use App\Services\Ledger;
use App\Services\LoanService;
use App\Services\PaymentService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

/**
 * Teller (live admin/teller_dashboard + admin/data_with_depost/{customer}).
 *
 * Documents: the teller only handles the cash channel — cash is recorded as PENDING_VERIFICATION in the
 * Teller Cash account with a receipt, the teller banks it (deposit slip) and Finance verifies/confirms.
 * Cash-out of approved loans belongs to the Loans module (Loan Withdrawal).
 */
class TellerController extends ApiController
{
    public function __construct(
        private readonly PaymentService $payments,
        private readonly LoanService $loans,
        private readonly Ledger $ledger,
    ) {}

    /**
     * Customer loan information, outstanding breakdown, branch cashbook and statement.
     */
    public function show(Customer $customer): JsonResponse
    {
        $this->authorizeAny('payments.cash', 'payments.verify');
        $this->assertBranchAccessible((int) $customer->branch_id);

        $loan = $this->payments->repayableLoan($customer)
            ?? $customer->loans()->whereNotIn('status', LoanStatus::values(...LoanStatus::inPipeline()))->latest('id')->first();
        $awaitingCashOut = $customer->loans()->where('status', LoanStatus::AwaitingDisbursement->value)->exists();

        $isRepayable = $loan !== null && in_array($loan->status, LoanStatus::repayable(), true);
        $isCashedOut = $loan !== null && in_array($loan->status, LoanStatus::disbursed(), true);
        $paid = $loan ? (float) $loan->paid_amount : 0.0;
        $outstanding = $loan ? $this->loans->outstanding($loan) : null;
        $pending = $loan ? $this->payments->pendingCash($loan) : 0.0;

        return response()->json(['data' => [
            'customer' => [
                'id' => $customer->id,
                'full_name' => strtoupper($customer->full_name),
                'customer_code' => $customer->customer_code,
                'phone' => $customer->phone,
                'photo_url' => $customer->photo_url,
                'branch' => $customer->branch?->name,
            ],
            'loan' => $loan ? [
                'id' => $loan->id,
                'loan_number' => $loan->loan_number,
                'reference_number' => $loan->reference_number,
                'status' => $loan->status->value,
                'status_label' => $loan->status->label(),
                'withdrawn_at' => $loan->withdrawn_at?->toDateString(),
                'end_date' => $loan->end_date?->toDateString(),
                'loan_amount' => $isCashedOut ? (float) $loan->total_payable : 0.0,
                'insurance' => $isCashedOut ? (float) $loan->insurance : 0.0,
                'restoration' => $isCashedOut ? (float) $loan->restoration : 0.0,
                'total_loan' => (float) $loan->total_payable + (float) $loan->insurance,
                'amount_paid' => $paid,
                'remaining_debt' => $isCashedOut ? (float) ($outstanding['total'] ?? 0) : 0.0,
                'is_repayable' => $isRepayable,
            ] : null,
            'outstanding' => $outstanding,
            'pending_cash' => $pending,
            'available_to_deposit' => $isRepayable ? max(0.0, round($outstanding['total'] - $pending, 2)) : 0.0,
            'salary_advance' => $loan ? (float) ($this->loans->deductions($loan)['salary_advance'] ?? 0) : 0.0,
            'recovery_amount' => 0.0,
            'penalty' => round((float) Penalty::where('customer_id', $customer->id)->where('is_waived', false)->selectRaw('COALESCE(SUM(amount - paid_amount),0) v')->value('v'), 2),
            'awaiting_cash_out' => $awaitingCashOut,
            'cashbook' => $this->cashbook(),
            'statement' => $loan ? $this->loanStatement($loan) : [],
            'receipts' => PaymentResource::collection(
                Payment::where('customer_id', $customer->id)->where('source', Payment::SOURCE_TELLER)->with(['employee', 'loan'])->latest('id')->limit(20)->get()
            ),
        ]]);
    }

    /**
     * Teller cash deposit → PENDING_VERIFICATION (live success text "Deposit successfully").
     */
    public function deposit(TellerDepositRequest $request, Customer $customer): JsonResponse
    {
        $this->authorizeAny('payments.cash');
        $this->assertBranchAccessible((int) $customer->branch_id);

        $loan = $this->payments->repayableLoan($customer);
        if ($loan === null) {
            throw ValidationException::withMessages(['depost' => 'This customer has no active loan.']);
        }

        $payment = $this->payments->recordCash($loan, (float) $request->input('depost'), $request->string('p_method')->toString(), $this->currentEmployee());

        return $this->message('Deposit successfully', 201, [
            'data' => new PaymentResource($payment->load(['customer', 'branch', 'employee', 'loan'])),
            'receipt' => $request->boolean('recept'),
        ]);
    }

    /**
     * Printable receipt for a teller cash payment.
     */
    public function receipt(Payment $payment): JsonResponse
    {
        $this->authorizeAny('payments.cash', 'payments.verify');
        if ($payment->branch_id !== null) {
            $this->assertBranchAccessible((int) $payment->branch_id);
        }

        $payment->load(['customer', 'branch', 'employee', 'loan']);
        $outstanding = $payment->loan ? $this->loans->outstanding($payment->loan) : null;

        return response()->json(['data' => (new PaymentResource($payment))->resolve() + [
            'company' => $this->currentCompany()->name,
            'outstanding' => $outstanding,
        ]]);
    }

    /**
     * Teller cash receipts in scope (the teller's cash position and the slips they belong to).
     */
    public function cash(Request $request): JsonResponse
    {
        $this->authorizeAny('payments.cash');

        $query = $this->scoped(Payment::query())
            ->where('source', Payment::SOURCE_TELLER)
            ->when($this->isBranchTeller(), fn ($query) => $query->where('employee_id', $this->currentEmployee()->id))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()), fn ($query) => $query->whereIn('status', [PaymentStatus::PendingVerification->value, PaymentStatus::Deposited->value]))
            ->with(['customer', 'branch', 'employee', 'loan', 'tellerDeposit'])
            ->latest('id');
        $this->applyFilters($query, $request, 'paid_on');

        $employee = $this->currentEmployee();

        return response()->json([
            'data' => PaymentResource::collection($query->get()),
            'teller_cash' => $this->ledger->balance($employee->company_id, Account::TellerCash, $employee->branch_id, employee: $employee),
        ]);
    }

    public function bankDeposits(Request $request): AnonymousResourceCollection
    {
        $this->authorizeAny('payments.cash');

        $query = $this->scoped(TellerDeposit::query())
            ->when($this->isBranchTeller(), fn ($query) => $query->where('employee_id', $this->currentEmployee()->id))
            ->with(['branch', 'employee', 'bankAccount', 'verifier', 'confirmer', 'payments.customer'])
            ->latest('id');
        $this->applyFilters($query, $request, 'deposit_date');

        return TellerDepositResource::collection($query->get());
    }

    /**
     * Teller submits a bank deposit slip for pending cash receipts.
     */
    public function storeBankDeposit(BankDepositRequest $request): JsonResponse
    {
        $this->authorizeAny('payments.cash');

        $branchIds = Payment::whereKey($request->input('payment_ids'))->where('company_id', $this->currentEmployee()->company_id)->distinct()->pluck('branch_id');
        if ($branchIds->count() !== 1) {
            throw ValidationException::withMessages(['payment_ids' => 'Select receipts of one branch.']);
        }
        $this->assertBranchAccessible((int) $branchIds->first());

        $deposit = $this->payments->submitBankDeposit($this->currentEmployee(), (int) $branchIds->first(), $request->validated(), array_map('intval', $request->input('payment_ids')));

        return $this->message('Bank deposit submitted successfully', 201, [
            'data' => new TellerDepositResource($deposit->load(['branch', 'employee', 'bankAccount', 'payments.customer'])),
        ]);
    }

    /**
     * Company bank accounts as {value,label} for the deposit slip form.
     */
    public function bankAccounts(): JsonResponse
    {
        $this->authorizeAny('payments.cash', 'payments.verify', 'payments.suspense');

        return response()->json(['data' => BankAccount::where('company_id', $this->currentEmployee()->company_id)->orderBy('name')->get()
            ->map(fn (BankAccount $account): array => ['value' => (string) $account->id, 'label' => $account->name])]);
    }

    /**
     * Branch cashbook on the teller page: Opening / Deposit / Withdrawal / Closing.
     *
     * @return array{opening: float, deposit: float, withdrawal: float, closing: float}
     */
    private function cashbook(): array
    {
        $employee = $this->currentEmployee();
        $today = CarbonImmutable::today();
        $branchIds = app(AccessControl::class)->branchIds($employee);

        $opening = $branchIds === null
            ? $this->ledger->balance($employee->company_id, Account::Principal, until: $today->subDay(), allBranches: true)
            : array_sum(array_map(fn (int $branchId): float => $this->ledger->balance($employee->company_id, Account::Principal, $branchId, until: $today->subDay()), $branchIds));

        $transactions = $this->scoped(LoanTransaction::query())->whereDate('transaction_date', $today->toDateString());
        $deposit = (float) (clone $transactions)->where('type', 'deposit')->sum('amount')
            + (float) $this->scoped(Payment::query())->where('source', Payment::SOURCE_TELLER)->whereDate('paid_on', $today->toDateString())->whereIn('status', [PaymentStatus::PendingVerification->value, PaymentStatus::Deposited->value])->sum('amount');
        $withdrawal = (float) (clone $transactions)->where('type', 'withdrawal')->sum('amount');

        return ['opening' => $opening, 'deposit' => $deposit, 'withdrawal' => $withdrawal, 'closing' => round($opening + $deposit - $withdrawal, 2)];
    }

    /**
     * Running statement: Date / Description / Deposit / Withdrawal / Balance / Remain Debit / Penalty.
     *
     * @return list<array<string, mixed>>
     */
    private function loanStatement(Loan $loan): array
    {
        $balance = 0.0;
        $remaining = (float) $loan->total_payable + (float) $loan->insurance;
        $penalties = Penalty::where('loan_id', $loan->id)->get(['amount', 'penalty_date']);

        return $loan->transactions()->orderBy('transaction_date')->orderBy('id')->get()
            ->map(function (LoanTransaction $transaction) use (&$balance, &$remaining, $penalties): array {
                $isDeposit = $transaction->type === 'deposit';
                $balance += $isDeposit ? (float) $transaction->amount : -(float) $transaction->amount;
                $remaining -= $isDeposit ? (float) $transaction->amount : 0;

                return [
                    'id' => $transaction->id,
                    'date' => $transaction->transaction_date->toDateString(),
                    'description' => $transaction->description,
                    'deposit' => $isDeposit ? (float) $transaction->amount : 0.0,
                    'withdrawal' => $isDeposit ? 0.0 : (float) $transaction->amount,
                    'balance' => round($balance, 2),
                    'remain' => max(0.0, round($remaining, 2)),
                    'penalty' => (float) $penalties->filter(fn (Penalty $penalty): bool => $penalty->penalty_date->lte($transaction->transaction_date))->sum('amount'),
                    'principal' => (float) $transaction->principal,
                    'interest' => (float) $transaction->interest,
                    'penalty_paid' => (float) $transaction->penalty,
                ];
            })->all();
    }

    private function isBranchTeller(): bool
    {
        return ! $this->currentEmployee()->can('payments.verify') && app(AccessControl::class)->branchIds($this->currentEmployee()) !== null;
    }
}
