<?php

namespace App\Http\Controllers\Bank;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Requests\Bank\BankToBranchRequest;
use App\Http\Requests\Bank\BankToHqRequest;
use App\Http\Requests\Bank\BranchToBankRequest;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class BankTransferController extends Controller
{
    public const BRANCH_TO_BANK = 'branch_to_bank';

    public const BANK_TO_BRANCH = 'bank_to_branch';

    public const BANK_TO_HQ = 'bank_to_hq';

    public function __construct(private Ledger $ledger) {}

    public function index(): View
    {
        return view('bank.transfers', [
            'transfers' => $this->transfers(self::BRANCH_TO_BANK)->where('status', 'pending')->get(),
            'branches' => $this->branches(),
            'bankAccounts' => $this->bankAccounts(),
            'branchAccounts' => Account::transferableBranchAccounts(),
        ]);
    }

    public function store(BranchToBankRequest $request): RedirectResponse
    {
        BankTransfer::create([
            'company_id' => $this->employee()->company_id,
            'type' => self::BRANCH_TO_BANK,
            'branch_id' => $request->integer('from_blanch_id'),
            'branch_account' => $request->string('ac_type')->toString(),
            'bank_account_id' => $request->integer('to_account_id'),
            'amount' => $request->float('amount'),
            'status' => 'pending',
            'transfer_date' => today(),
        ]);

        return back()->with('success', 'Transaction Sent successfully');
    }

    /**
     * Approving moves the amount from the branch sub-account into the bank account.
     * Inferred: the live approve action was hidden, so the conventional ledger movement is used.
     */
    public function approve(BankTransfer $bankTransfer): RedirectResponse
    {
        if ($bankTransfer->status !== 'pending' || $bankTransfer->type !== self::BRANCH_TO_BANK) {
            return back()->with('error', 'Transaction already processed');
        }

        $account = Account::from($bankTransfer->branch_account);
        $available = $this->ledger->balance($bankTransfer->company_id, $account, $bankTransfer->branch_id);

        if ($available < (float) $bankTransfer->amount) {
            return back()->with('error', 'Insufficient balance in '.$account->label());
        }

        DB::transaction(function () use ($bankTransfer, $account): void {
            $this->ledger->transfer(
                $bankTransfer->company_id,
                ['account' => $account, 'branch' => $bankTransfer->branch_id],
                ['account' => Account::Bank, 'bank' => $bankTransfer->bank_account_id],
                (float) $bankTransfer->amount,
                'Branch to bank transfer',
                $bankTransfer,
            );

            $bankTransfer->update(['status' => 'approved']);
        });

        return back()->with('success', 'Transaction Aproved successfully');
    }

    public function destroy(BankTransfer $bankTransfer): RedirectResponse
    {
        if ($bankTransfer->status !== 'pending') {
            return back()->with('error', 'Aproved transaction cannot be deleted');
        }

        $bankTransfer->delete();

        return back()->with('success', 'Transaction Deleted successfully');
    }

    public function approved(Request $request): View
    {
        $query = $this->transfers(self::BRANCH_TO_BANK)->where('status', 'approved');
        $this->applyFilters($query, $request, true);

        return view('bank.transfers-approved', [
            'transfers' => $query->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function toBranch(Request $request): View
    {
        $query = $this->transfers(self::BANK_TO_BRANCH);
        $this->applyFilters($query, $request, true);

        return view('bank.to-branch', [
            'transfers' => $query->get(),
            'branches' => $this->branches(),
            'bankAccounts' => $this->bankAccounts(),
        ]);
    }

    /**
     * Bank account is debited amount + charge; the branch Principal account is credited the amount.
     */
    public function storeToBranch(BankToBranchRequest $request): RedirectResponse
    {
        $bankAccount = BankAccount::findOrFail($request->integer('from_account'));
        $amount = $request->float('amount');
        $charge = $request->float('charger_fee');

        if ($bankAccount->balance() < $amount + $charge) {
            return back()->withInput()->with('error', 'Insufficient balance in '.$bankAccount->name);
        }

        DB::transaction(function () use ($request, $bankAccount, $amount, $charge): void {
            $transfer = BankTransfer::create([
                'company_id' => $this->employee()->company_id,
                'type' => self::BANK_TO_BRANCH,
                'branch_id' => $request->integer('to_blanch'),
                'branch_account' => Account::Principal->value,
                'bank_account_id' => $bankAccount->id,
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

        return back()->with('success', 'Transaction Sent successfully');
    }

    public function toHq(Request $request): View
    {
        $query = $this->transfers(self::BANK_TO_HQ);
        $this->applyFilters($query, $request, false);

        return view('bank.to-hq', [
            'transfers' => $query->get(),
            'bankAccounts' => $this->bankAccounts(),
        ]);
    }

    /**
     * Bank account is debited amount + charge; the HQ salary advance or disbursement account is credited.
     */
    public function storeToHq(BankToHqRequest $request): RedirectResponse
    {
        $bankAccount = BankAccount::findOrFail($request->integer('from_acc'));
        $amount = $request->float('amount');
        $charge = $request->float('charger_fee');
        $hqAccount = $request->string('to_acc')->toString() === 'salary' ? Account::HqSalaryAdvance : Account::HqDisbursement;

        if ($bankAccount->balance() < $amount + $charge) {
            return back()->withInput()->with('error', 'Insufficient balance in '.$bankAccount->name);
        }

        DB::transaction(function () use ($bankAccount, $amount, $charge, $hqAccount): void {
            $transfer = BankTransfer::create([
                'company_id' => $this->employee()->company_id,
                'type' => self::BANK_TO_HQ,
                'bank_account_id' => $bankAccount->id,
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

        return back()->with('success', 'Transaction Sent successfully');
    }

    /**
     * @return Builder<BankTransfer>
     */
    private function transfers(string $type): Builder
    {
        return BankTransfer::where('company_id', $this->employee()->company_id)
            ->where('type', $type)
            ->with(['branch', 'bankAccount'])
            ->latest('id');
    }

    /**
     * @param  Builder<BankTransfer>  $query
     */
    private function applyFilters(Builder $query, Request $request, bool $byBranch): void
    {
        if ($byBranch && $request->filled('blanch_id') && $request->input('blanch_id') !== 'all') {
            $query->where('branch_id', $request->integer('blanch_id'));
        }

        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('transfer_date', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]);
        }
    }

    /**
     * @return Collection<int, BankAccount>
     */
    private function bankAccounts(): Collection
    {
        return BankAccount::where('company_id', $this->employee()->company_id)->orderBy('id')->get();
    }
}
