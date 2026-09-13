<?php

namespace App\Http\Controllers\Capital;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\FloatTransfer;
use App\Services\Ledger;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;
use Illuminate\View\View;

class FloatController extends Controller
{
    /**
     * Live "PR" / "INT" option values of the account-to-account form.
     *
     * @var array<string, Account>
     */
    private const BRANCH_ACCOUNTS = ['PR' => Account::Principal, 'INT' => Account::Interest];

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Company → branch floats. Shows today's transfers unless the "Previous" filter is used.
     */
    public function companyTransfers(Request $request): View
    {
        $validated = $request->validate([
            'blanch_id' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        [$from, $to] = $this->dateRange($validated);
        $branchId = $validated['blanch_id'] ?? null;

        $transfers = FloatTransfer::where('company_id', $this->employee()->company_id)
            ->where('type', 'company_to_branch')
            ->whereDate('transfer_date', '>=', $from->toDateString())
            ->whereDate('transfer_date', '<=', $to->toDateString())
            ->when($branchId !== null && $branchId !== 'all', fn ($query) => $query->where('to_branch_id', (int) $branchId))
            ->with('toBranch')
            ->orderBy('id')
            ->get();

        return view('capital.floats.company', [
            'transfers' => $transfers,
            'branches' => $this->branches(),
        ]);
    }

    /**
     * Inferred: the company account must hold enough balance for the float.
     */
    public function storeCompany(Request $request): RedirectResponse
    {
        $companyId = $this->employee()->company_id;

        $validated = $request->validate([
            'blanch_amount' => ['required', 'numeric', 'min:1'],
            'blanch_id' => ['required', $this->branchRule()],
        ]);

        $amount = (float) $validated['blanch_amount'];

        if ($this->ledger->balance($companyId, Account::Company) < $amount) {
            return back()->withInput()->with('error', 'Insufficient balance in Company Account');
        }

        DB::transaction(function () use ($companyId, $validated, $amount): void {
            $transfer = FloatTransfer::create([
                'company_id' => $companyId,
                'type' => 'company_to_branch',
                'to_branch_id' => $validated['blanch_id'],
                'amount' => $amount,
                'status' => 'approved',
                'transfer_date' => today(),
            ]);

            $this->ledger->transfer(
                $companyId,
                ['account' => Account::Company],
                ['account' => Account::Principal, 'branch' => (int) $validated['blanch_id']],
                $amount,
                'FLOAT FROM COMPANY ACCOUNT',
                $transfer,
            );
        });

        return back()->with('success', 'Float Transfered successfully');
    }

    public function branch(): View
    {
        return view('capital.floats.branch', [
            'transfers' => FloatTransfer::where('company_id', $this->employee()->company_id)
                ->where('type', 'branch_to_branch')
                ->where('status', 'pending')
                ->with(['fromBranch', 'toBranch'])
                ->orderBy('id')
                ->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function storeBranch(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'from_blanch_id' => ['required', $this->branchRule()],
            'to_blanch_id' => ['required', 'different:from_blanch_id', $this->branchRule()],
            'trans_amount' => ['required', 'numeric', 'min:1'],
        ], [
            'to_blanch_id.different' => 'You cannot transfer float to the same branch',
        ]);

        FloatTransfer::create([
            'company_id' => $this->employee()->company_id,
            'type' => 'branch_to_branch',
            'from_branch_id' => $validated['from_blanch_id'],
            'to_branch_id' => $validated['to_blanch_id'],
            'amount' => $validated['trans_amount'],
            'status' => 'pending',
            'transfer_date' => today(),
        ]);

        return back()->with('success', 'Float Transfer Requested successfully');
    }

    /**
     * Inferred: approval moves the float from the sending branch's principal account
     * to the receiving branch's principal account, provided the sender has enough balance.
     */
    public function approve(FloatTransfer $floatTransfer): RedirectResponse
    {
        if ($floatTransfer->type !== 'branch_to_branch' || $floatTransfer->status !== 'pending') {
            return back()->with('error', 'Transaction is already processed');
        }

        $amount = (float) $floatTransfer->amount;

        if ($this->ledger->balance($floatTransfer->company_id, Account::Principal, $floatTransfer->from_branch_id) < $amount) {
            return back()->with('error', 'Insufficient balance in '.Account::Principal->label());
        }

        DB::transaction(function () use ($floatTransfer, $amount): void {
            $this->ledger->transfer(
                $floatTransfer->company_id,
                ['account' => Account::Principal, 'branch' => $floatTransfer->from_branch_id],
                ['account' => Account::Principal, 'branch' => $floatTransfer->to_branch_id],
                $amount,
                'FLOAT BRANCH TO BRANCH',
                $floatTransfer,
            );

            $floatTransfer->update(['status' => 'approved', 'transfer_date' => today()]);
        });

        return back()->with('success', 'Float Aproved successfully');
    }

    public function destroy(FloatTransfer $floatTransfer): RedirectResponse
    {
        if ($floatTransfer->status !== 'pending') {
            return back()->with('error', 'Aproved transaction cannot be deleted');
        }

        $floatTransfer->delete();

        return back()->with('success', 'Transaction Deleted successfully');
    }

    /**
     * Approved branch → branch floats; today's unless filtered by date.
     */
    public function approved(Request $request): View
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        [$from, $to] = $this->dateRange($validated);

        $transfers = FloatTransfer::where('company_id', $this->employee()->company_id)
            ->where('type', 'branch_to_branch')
            ->where('status', 'approved')
            ->whereDate('transfer_date', '>=', $from->toDateString())
            ->whereDate('transfer_date', '<=', $to->toDateString())
            ->with(['fromBranch', 'toBranch'])
            ->orderBy('id')
            ->get();

        return view('capital.floats.approved', ['transfers' => $transfers]);
    }

    public function accounts(): View
    {
        return view('capital.floats.accounts', ['branches' => $this->branches()]);
    }

    /**
     * Moves money between a branch's PRINCIPAL and INTEREST accounts (ledger only; the live page keeps no list).
     */
    public function storeAccounts(Request $request): RedirectResponse
    {
        $companyId = $this->employee()->company_id;

        $validated = $request->validate([
            'blanch_id' => ['required', $this->branchRule()],
            'from_acc' => ['required', Rule::in(array_keys(self::BRANCH_ACCOUNTS))],
            'to_acc' => ['required', 'different:from_acc', Rule::in(array_keys(self::BRANCH_ACCOUNTS))],
            'amount' => ['required', 'numeric', 'min:1'],
        ], [
            'to_acc.different' => 'You cannot transfer float to the same account',
        ]);

        $from = self::BRANCH_ACCOUNTS[$validated['from_acc']];
        $to = self::BRANCH_ACCOUNTS[$validated['to_acc']];
        $branchId = (int) $validated['blanch_id'];
        $amount = (float) $validated['amount'];

        if ($this->ledger->balance($companyId, $from, $branchId) < $amount) {
            return back()->withInput()->with('error', 'Insufficient balance in '.$from->label());
        }

        $this->ledger->transfer(
            $companyId,
            ['account' => $from, 'branch' => $branchId],
            ['account' => $to, 'branch' => $branchId],
            $amount,
            'FLOAT '.$from->label().' TO '.$to->label(),
        );

        return back()->with('success', 'Float Transfered successfully');
    }

    private function branchRule(): Exists
    {
        return Rule::exists((new Branch)->getTable(), 'id')->where('company_id', $this->employee()->company_id);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array{0: Carbon, 1: Carbon}
     */
    private function dateRange(array $validated): array
    {
        return [
            Carbon::parse($validated['from'] ?? today()),
            Carbon::parse($validated['to'] ?? today()),
        ];
    }
}
