<?php

namespace App\Http\Controllers\Expenses;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Requests\Expenses\AcceptExpenseRequest;
use App\Http\Requests\Expenses\ExpenseRequestRequest;
use App\Models\BankAccount;
use App\Models\BankTransfer;
use App\Models\ExpenseRequest;
use App\Models\ExpenseType;
use App\Models\FloatTransfer;
use App\Services\Ledger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class ExpenseRequestController extends Controller
{
    public function __construct(private Ledger $ledger) {}

    /**
     * Served at both "Recomended Expenses" and the "Aprove Section" page.
     */
    public function branchRequests(Request $request): View
    {
        $query = $this->requests('branch')->where('status', 'pending');
        $isApproveSection = $request->routeIs('expenses.approve-section');

        if ($isApproveSection && $request->filled('blanch_id') && $request->input('blanch_id') !== 'all') {
            $query->where('branch_id', $request->integer('blanch_id'));
        }

        $companyId = $this->employee()->company_id;

        return view($isApproveSection ? 'expenses.approve-section' : 'expenses.requests', [
            'expenseRequests' => $query->get(),
            'branches' => $this->branches(),
            'expenseTypes' => $this->expenseTypes('branch'),
            'pendingFloats' => $isApproveSection ? FloatTransfer::where('company_id', $companyId)->where('status', 'pending')->count() : 0,
            'pendingBank' => $isApproveSection ? BankTransfer::where('company_id', $companyId)->where('status', 'pending')->count() : 0,
        ]);
    }

    public function branchAccepted(Request $request): View
    {
        $query = $this->requests('branch')->where('status', 'accepted');

        if ($request->filled('blanch_id') && $request->input('blanch_id') !== 'all') {
            $query->where('branch_id', $request->integer('blanch_id'));
        }

        $this->applyDateFilter($query, $request);

        return view('expenses.accepted', [
            'expenseRequests' => $query->get(),
            'branches' => $this->branches(),
        ]);
    }

    public function hqRequests(): View
    {
        return view('expenses.hq-requests', [
            'expenseRequests' => $this->requests('hq')->where('status', 'pending')->get(),
            'expenseTypes' => $this->expenseTypes('hq'),
            'approved' => false,
        ]);
    }

    public function hqApproved(Request $request): View
    {
        $query = $this->requests('hq')->where('status', 'accepted');
        $this->applyDateFilter($query, $request);

        return view('expenses.hq-requests', [
            'expenseRequests' => $query->get(),
            'expenseTypes' => collect(),
            'approved' => true,
        ]);
    }

    public function bankRequests(): View
    {
        $bankAccounts = BankAccount::where('company_id', $this->employee()->company_id)->orderBy('id')->get();

        return view('expenses.bank-requests', [
            'expenseRequests' => $this->requests('bank')->get(),
            'bankAccounts' => $bankAccounts,
            'expenseTypes' => $this->expenseTypes('bank'),
        ]);
    }

    public function store(ExpenseRequestRequest $request): RedirectResponse
    {
        ExpenseRequest::create($request->requestData() + [
            'company_id' => $this->employee()->company_id,
            'employee_id' => $this->employee()->id,
            'status' => 'pending',
            'request_date' => today(),
        ]);

        return back()->with('success', 'Expenses Requested successfully');
    }

    /**
     * Accepting pays the expense: branch requests debit the branch Principal account, HQ requests
     * debit the Company account and bank requests debit the chosen bank account.
     * Inferred: the live server-side posting could not be observed.
     */
    public function accept(AcceptExpenseRequest $request, ExpenseRequest $expenseRequest): RedirectResponse
    {
        if ($expenseRequest->status !== 'pending') {
            return back()->with('error', 'Expenses already accepted');
        }

        $amount = $request->filled('req_amount') ? $request->float('req_amount') : (float) $expenseRequest->amount;
        $companyId = $expenseRequest->company_id;

        $available = match ($expenseRequest->scope) {
            'branch' => $this->ledger->balance($companyId, Account::Principal, $expenseRequest->branch_id),
            'bank' => $this->ledger->balance($companyId, Account::Bank, bankAccount: $expenseRequest->bank_account_id),
            default => null,
        };

        if ($available !== null && $available < $amount) {
            return back()->with('error', 'Insufficient balance');
        }

        DB::transaction(function () use ($request, $expenseRequest, $amount, $companyId): void {
            $expenseRequest->update([
                'amount' => $amount,
                'comment' => $request->filled('req_comment') ? $request->string('req_comment')->toString() : $expenseRequest->comment,
                'status' => 'accepted',
            ]);

            $description = 'Expenses: '.$expenseRequest->expenseType?->name;

            match ($expenseRequest->scope) {
                'branch' => $this->ledger->post($companyId, Account::Principal, -$amount, $description, $expenseRequest->branch_id, $expenseRequest),
                'bank' => $this->ledger->post($companyId, Account::Bank, -$amount, $description, null, $expenseRequest, $expenseRequest->bank_account_id),
                default => $this->ledger->post($companyId, Account::Company, -$amount, $description, null, $expenseRequest),
            };
        });

        return back()->with('success', 'Expenses Accepted successfully');
    }

    public function destroy(ExpenseRequest $expenseRequest): RedirectResponse
    {
        if ($expenseRequest->status !== 'pending') {
            return back()->with('error', 'Accepted expenses cannot be deleted');
        }

        $expenseRequest->delete();

        return back()->with('success', 'Expenses Deleted successfully');
    }

    /**
     * @return Builder<ExpenseRequest>
     */
    private function requests(string $scope): Builder
    {
        return ExpenseRequest::where('company_id', $this->employee()->company_id)
            ->where('scope', $scope)
            ->with(['branch', 'expenseType', 'bankAccount', 'employee'])
            ->latest('id');
    }

    /**
     * @return Collection<int, ExpenseType>
     */
    private function expenseTypes(string $scope): Collection
    {
        return ExpenseType::where('company_id', $this->employee()->company_id)->where('scope', $scope)->orderBy('id')->get();
    }

    /**
     * @param  Builder<ExpenseRequest>  $query
     */
    private function applyDateFilter(Builder $query, Request $request): void
    {
        if ($request->filled('from') && $request->filled('to')) {
            $query->whereBetween('request_date', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]);
        }
    }
}
