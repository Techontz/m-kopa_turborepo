<?php

namespace App\Http\Controllers\Api\V1\Bank;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Bank\BankToBranchRequest;
use App\Http\Requests\Api\Bank\BankToHqRequest;
use App\Http\Requests\Api\Bank\BranchToBankRequest;
use App\Http\Requests\Api\Bank\CompanyFundTransferRequest;
use App\Http\Resources\Api\V1\Bank\BankTransferResource;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Services\CompanyFunds;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Bank → Bank Transaction / Approved Transaction (branch → bank, request then approve),
 * Transfer Balance /Branch Acc (bank → branch PRINCIPAL A/C) and
 * Transfer Balance /Salary advance & disbursement Acc (bank → HQ account) and
 * Company Cash ↔ Bank (COMPANY ACCOUNT ↔ bank account, {@see CompanyFunds}).
 */
class BankTransferController extends ApiController
{
    public const BRANCH_TO_BANK = 'branch_to_bank';

    public const BANK_TO_BRANCH = 'bank_to_branch';

    public const BANK_TO_HQ = 'bank_to_hq';

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Pending (default) or approved branch → bank transactions; approved list takes the branch/date filter.
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        $status = $request->input('status') === 'approved' ? 'approved' : 'pending';
        $query = $this->transfers(self::BRANCH_TO_BANK)->where('status', $status);

        if ($status === 'approved') {
            $this->applyFilters($query, $request, 'transfer_date');
        }

        return $this->collection($query);
    }

    public function store(BranchToBankRequest $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertBranchAccessible($request->integer('from_blanch_id'));

        $transfer = BankTransfer::create([
            'company_id' => $this->currentEmployee()->company_id,
            'type' => self::BRANCH_TO_BANK,
            'branch_id' => $request->integer('from_blanch_id'),
            'branch_account' => $request->string('ac_type')->toString(),
            'bank_account_id' => $request->integer('to_account_id'),
            'employee_id' => $this->currentEmployee()->id,
            'amount' => $request->float('amount'),
            'status' => 'pending',
            'transfer_date' => today(),
        ]);

        return $this->message('Transaction Sent successfully', 201, ['data' => new BankTransferResource($transfer->load(['branch', 'bankAccount']))]);
    }

    /**
     * Approving moves the amount from the branch sub-account into the bank account.
     * Inferred: the live approve action was hidden, so the conventional ledger movement is used.
     */
    public function approve(BankTransfer $bankTransfer): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertTransferVisible($bankTransfer);

        DB::transaction(function () use ($bankTransfer): void {
            $transfer = BankTransfer::whereKey($bankTransfer->id)->lockForUpdate()->firstOrFail();

            if ($transfer->status !== 'pending' || $transfer->type !== self::BRANCH_TO_BANK) {
                throw ValidationException::withMessages(['amount' => 'Transaction already processed']);
            }

            $account = Account::from($transfer->branch_account);
            if ($this->ledger->balance($transfer->company_id, $account, $transfer->branch_id) < (float) $transfer->amount) {
                throw ValidationException::withMessages(['amount' => 'Insufficient balance in '.$account->label()]);
            }

            $this->ledger->transfer(
                $transfer->company_id,
                ['account' => $account, 'branch' => $transfer->branch_id],
                ['account' => Account::Bank, 'bank' => $transfer->bank_account_id],
                (float) $transfer->amount,
                'Branch to bank transfer',
                $transfer,
            );

            $transfer->update(['status' => 'approved', 'approved_by' => $this->currentEmployee()->id]);
        });

        return $this->message('Transaction Approved successfully');
    }

    public function destroy(BankTransfer $bankTransfer): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertTransferVisible($bankTransfer);

        if ($bankTransfer->status !== 'pending') {
            return $this->message('Approved transaction cannot be deleted', 422);
        }

        $bankTransfer->delete();

        return $this->message('Transaction Deleted successfully');
    }

    public function toBranchIndex(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        return $this->collection($this->applyFilters($this->transfers(self::BANK_TO_BRANCH), $request, 'transfer_date'));
    }

    /**
     * Bank account is credited amount + charge; the branch PRINCIPAL A/C is debited the amount, the charge goes to BANK CHARGES.
     */
    public function toBranchStore(BankToBranchRequest $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $this->assertBranchAccessible($request->integer('to_blanch'));

        DB::transaction(function () use ($request): void {
            $bankAccount = BankAccount::whereKey($request->integer('from_account'))->lockForUpdate()->firstOrFail();
            $amount = $request->float('amount');
            $charge = $request->float('charger_fee');
            $this->assertBankFunds($bankAccount, $amount + $charge);

            $transfer = BankTransfer::create([
                'company_id' => $this->currentEmployee()->company_id,
                'type' => self::BANK_TO_BRANCH,
                'branch_id' => $request->integer('to_blanch'),
                'branch_account' => Account::Principal->value,
                'bank_account_id' => $bankAccount->id,
                'employee_id' => $this->currentEmployee()->id,
                'amount' => $amount,
                'charge' => $charge,
                'status' => 'approved',
                'transfer_date' => today(),
            ]);

            $this->ledger->transfer(
                $transfer->company_id,
                ['account' => Account::Bank, 'bank' => $bankAccount->id],
                ['account' => Account::Principal, 'branch' => $transfer->branch_id],
                $amount,
                'Bank to branch transfer',
                $transfer,
                $charge,
            );
        });

        return $this->message('Transaction Sent successfully', 201);
    }

    public function toHqIndex(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        return $this->collection($this->applyFilters($this->transfers(self::BANK_TO_HQ), $request->merge(['branch_id' => null]), 'transfer_date'));
    }

    /**
     * Bank account is credited amount + charge; the HQ SALARY ADVANCE or DISBURSEMENT ACCOUNT is debited the amount.
     */
    public function toHqStore(BankToHqRequest $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        DB::transaction(function () use ($request): void {
            $bankAccount = BankAccount::whereKey($request->integer('from_acc'))->lockForUpdate()->firstOrFail();
            $amount = $request->float('amount');
            $charge = $request->float('charger_fee');
            $hqAccount = $request->string('to_acc')->toString() === 'salary' ? Account::HqSalaryAdvance : Account::HqDisbursement;
            $this->assertBankFunds($bankAccount, $amount + $charge);

            $transfer = BankTransfer::create([
                'company_id' => $this->currentEmployee()->company_id,
                'type' => self::BANK_TO_HQ,
                'bank_account_id' => $bankAccount->id,
                'employee_id' => $this->currentEmployee()->id,
                'hq_account' => $hqAccount->value,
                'amount' => $amount,
                'charge' => $charge,
                'status' => 'approved',
                'transfer_date' => today(),
            ]);

            $this->ledger->transfer(
                $transfer->company_id,
                ['account' => Account::Bank, 'bank' => $bankAccount->id],
                ['account' => $hqAccount],
                $amount,
                'Bank to headquarter transfer',
                $transfer,
                $charge,
            );
        });

        return $this->message('Transaction Sent successfully', 201);
    }

    /**
     * Company Cash ↔ Bank: movements between the COMPANY ACCOUNT and company bank accounts (both directions).
     */
    public function companyIndex(Request $request): JsonResponse
    {
        $this->authorizeAny('bank.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $query = BankTransfer::query()
            ->where('company_id', $this->currentEmployee()->company_id)
            ->whereIn('type', [CompanyFunds::CASH_TO_BANK, CompanyFunds::BANK_TO_CASH])
            ->with(['bankAccount', 'employee', 'journalEntry'])
            ->latest('id');

        $transfers = $this->applyFilters($query, $request->merge(['branch_id' => null]), 'transfer_date')->get();

        return response()->json([
            'data' => BankTransferResource::collection($transfers),
            'total' => round((float) $transfers->sum('amount'), 2),
            'company_cash_balance' => $this->ledger->balance($this->currentEmployee()->company_id, Account::Company) + 0.0,
        ]);
    }

    public function companyStore(CompanyFundTransferRequest $request, CompanyFunds $funds): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        $result = $funds->transfer(
            $this->currentEmployee()->company_id,
            $request->string('direction')->toString(),
            $request->integer('bank_account_id'),
            $request->float('amount'),
            $this->currentEmployee(),
            $request->input('reference'),
            $request->input('idempotency_key'),
        );

        return $this->message(
            $result['created'] ? 'Transfer Completed successfully' : 'Transfer was already recorded',
            $result['created'] ? 201 : 200,
            ['data' => new BankTransferResource($result['transfer']->load(['bankAccount', 'employee', 'journalEntry']))],
        );
    }

    /**
     * Branch accounts that can send money to a bank ("Select Account" dropdown).
     */
    public function branchAccountOptions(): JsonResponse
    {
        $this->authorizeAny('bank.manage');

        return response()->json(['data' => array_map(fn (Account $account): array => ['value' => $account->value, 'label' => $account->label()], Account::transferableBranchAccounts())]);
    }

    /**
     * @return Builder<BankTransfer>
     */
    private function transfers(string $type): Builder
    {
        $query = BankTransfer::query()->where('type', $type)->with(['branch', 'bankAccount'])->latest('id');

        return $type === self::BANK_TO_HQ
            ? $query->where('company_id', $this->currentEmployee()->company_id)
            : $this->scoped($query);
    }

    /**
     * @param  Builder<BankTransfer>  $query
     */
    private function collection(Builder $query): JsonResponse
    {
        $transfers = $query->get();

        return response()->json([
            'data' => BankTransferResource::collection($transfers),
            'total' => round((float) $transfers->sum('amount'), 2),
            'total_charge' => round((float) $transfers->sum('charge'), 2),
        ]);
    }

    private function assertTransferVisible(BankTransfer $bankTransfer): void
    {
        if ($bankTransfer->branch_id !== null) {
            $this->assertBranchAccessible($bankTransfer->branch_id);
        }
    }

    private function assertBankFunds(BankAccount $bankAccount, float $required): void
    {
        if ($bankAccount->balance() < $required) {
            throw ValidationException::withMessages(['amount' => 'Insufficient balance in '.$bankAccount->name]);
        }
    }
}
