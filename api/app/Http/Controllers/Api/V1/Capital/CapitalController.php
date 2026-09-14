<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\CapitalRequest;
use App\Models\BankAccount;
use App\Models\Capital;
use App\Models\LoanTransaction;
use App\Models\ShareHolder;
use App\Services\CapitalContributions;
use App\Services\Ledger;
use App\Services\ShareholderOwnership;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Capital → Add Capitals (live admin/capital). Documents (ACCOUNT OVERVIEW "Capital Account", handwritten note):
 * capital is added by the super admin; only capital.view users see it. Every contribution is its own row posted
 * Dr the receiving company account (COMPANY ACCOUNT for CASH, the selected bank account for BANK) / Cr CAPITAL ACCOUNT.
 * Contributions are financial transactions; ownership comes from the share register ({@see ShareholderOwnership}) and
 * company balances are reported separately.
 */
class CapitalController extends ApiController
{
    public function __construct(
        private readonly Ledger $ledger,
        private readonly CapitalContributions $contributions,
        private readonly ShareholderOwnership $ownership,
    ) {}

    public function index(): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        $companyId = $this->currentEmployee()->company_id;
        $capitals = Capital::where('company_id', $companyId)
            ->with(['bankAccount', 'recorder', 'journalEntry', 'shareTransactions'])
            ->orderBy('id')
            ->get()
            ->groupBy('share_holder_id');
        $banks = $this->bankBalances($companyId);
        $companyCash = $this->ledger->balance($companyId, Account::Company) + 0.0;

        return response()->json(['data' => [
            'share_holders' => $this->ownership->summary($companyId)->map(fn (array $row): array => [
                'id' => $row['share_holder']->id,
                'name' => $row['share_holder']->full_name,
                'total' => $row['total_contributed'],
                'total_contributed' => $row['total_contributed'],
                'shares' => $row['shares'],
                'ownership_percent' => $row['ownership_percent'],
                'holding_value' => $row['holding_value'],
                'capitals' => ($capitals[$row['share_holder']->id] ?? collect())->map(fn (Capital $capital): array => $this->presentContribution($capital))->values(),
            ])->values(),
            'share_holder_capital' => $this->ownership->totalContributed($companyId),
            'company_capital' => $companyCash,
            'company_cash_balance' => $companyCash,
            'bank_balances' => $banks,
            'bank_balance_total' => round($banks->sum('balance'), 2),
            'capital_account' => $this->ledger->balance($companyId, Account::Capital, allBranches: true) + 0.0,
        ]]);
    }

    public function store(CapitalRequest $request): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $employee = $this->currentEmployee();
        $result = $this->contributions->contribute(
            ShareHolder::where('company_id', $employee->company_id)->findOrFail($request->integer('share_id')),
            $request->float('amount'),
            $request->string('pay_method')->toString(),
            $request->filled('bank_account_id') ? $request->integer('bank_account_id') : null,
            $employee,
            $request->input('recept'),
            $request->input('chaque_no'),
            $request->filled('contributed_at') ? CarbonImmutable::parse($request->string('contributed_at')->toString()) : null,
            $request->input('idempotency_key'),
            fn (Capital $capital) => $this->storeReceipt($capital, $request->file('receipt_file')),
        );

        return $this->message(
            $result['created'] ? 'Capital Added successfully' : 'Capital was already recorded',
            $result['created'] ? 201 : 200,
            ['data' => $this->presentContribution($result['capital']->load(['bankAccount', 'recorder', 'journalEntry']))],
        );
    }

    /**
     * Contribution history of one shareholder with their contribution total and share-register ownership.
     */
    public function history(ShareHolder $shareHolder): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        $ownership = $this->ownership->forShareHolder($shareHolder);

        return response()->json(['data' => [
            'share_holder' => ['id' => $shareHolder->id, 'first_name' => $shareHolder->first_name, 'middle_name' => $shareHolder->middle_name, 'last_name' => $shareHolder->last_name, 'name' => $shareHolder->full_name],
            'total_contributed' => $ownership['total_contributed'],
            'shares' => $ownership['shares'],
            'total_shares' => $ownership['total_shares'],
            'ownership_percent' => $ownership['ownership_percent'],
            'holding_value' => $ownership['holding_value'],
            'company_total_contributed' => $this->ownership->totalContributed((int) $shareHolder->company_id),
            'contributions' => $shareHolder->capitals()->with(['bankAccount', 'recorder', 'journalEntry', 'shareTransactions'])->orderBy('id')->get()
                ->map(fn (Capital $capital): array => $this->presentContribution($capital))->values(),
        ]]);
    }

    /**
     * Company capital position: historical shareholder contributions (financial records, not ownership) kept apart from what the
     * company holds and earns now — COMPANY ACCOUNT and bank balances, branch lending cash, income, expenses and loans.
     */
    public function position(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');
        $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);

        $companyId = $this->currentEmployee()->company_id;
        $from = $request->filled('from') ? CarbonImmutable::parse($request->string('from')->toString()) : null;
        $to = $request->filled('to') ? CarbonImmutable::parse($request->string('to')->toString()) : null;
        $sum = fn (string $type): float => round(array_sum(array_map(
            fn (Account $account): float => $this->ledger->balance($companyId, $account, until: $to, allBranches: true, from: $from),
            array_filter(Account::cases(), fn (Account $account): bool => $account->type() === $type),
        )), 2) + 0.0;

        $banks = $this->bankBalances($companyId);
        $companyCash = $this->ledger->balance($companyId, Account::Company) + 0.0;
        $branchCash = $this->ledger->balance($companyId, Account::Principal, allBranches: true) + 0.0;
        $income = $sum('income');
        $expenses = $sum('expense');
        $withdrawals = LoanTransaction::where('company_id', $companyId)->where('type', 'withdrawal')
            ->when($from, fn ($query) => $query->whereDate('transaction_date', '>=', $from->toDateString()))
            ->when($to, fn ($query) => $query->whereDate('transaction_date', '<=', $to->toDateString()));

        return response()->json(['data' => [
            'shareholder_contributions' => [
                'total' => $this->ownership->totalContributed($companyId),
                'share_holders' => $this->ownership->summary($companyId)->map(fn (array $row): array => [
                    'id' => $row['share_holder']->id,
                    'name' => $row['share_holder']->full_name,
                    'total_contributed' => $row['total_contributed'],
                    'contributions_count' => $row['contributions_count'],
                    'shares' => $row['shares'],
                    'ownership_percent' => $row['ownership_percent'],
                ])->values(),
            ],
            'balances' => [
                'company_cash' => $companyCash,
                'banks' => $banks,
                'bank_total' => round($banks->sum('balance'), 2),
                'branch_lending_cash' => $branchCash,
                'total_cash_and_bank' => round($companyCash + $banks->sum('balance') + $branchCash, 2),
            ],
            'income' => $income,
            'expenses' => $expenses,
            'net_income' => round($income - $expenses, 2),
            'loans' => [
                'disbursed_count' => (clone $withdrawals)->count(),
                'disbursed_total' => round((float) $withdrawals->sum('amount'), 2),
                'outstanding_principal' => $this->ledger->balance($companyId, Account::LoanReceivable, allBranches: true) + 0.0,
            ],
            'capital_account_ledger' => $this->ledger->balance($companyId, Account::Capital, allBranches: true) + 0.0,
            'from' => $from?->toDateString(),
            'to' => $to?->toDateString(),
        ]]);
    }

    /**
     * The uploaded receipt (PDF or image), streamed from private storage to users who may see capital.
     */
    public function receipt(Capital $capital): StreamedResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        abort_unless($capital->receipt_file && Storage::disk(Capital::DISK)->exists($capital->receipt_file), 404);

        return Storage::disk(Capital::DISK)->response($capital->receipt_file, $capital->receipt_file_name, ['Cache-Control' => 'private, max-age=300'], 'inline');
    }

    /**
     * Attach or replace the receipt file. The capital amount and its ledger entry are not editable (reversal only);
     * only the supporting document can be replaced. Audit-logged through the Auditable trait.
     */
    public function replaceReceipt(Request $request, Capital $capital): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $request->validate(
            ['receipt_file' => ['required', 'file', 'mimes:'.implode(',', CapitalRequest::RECEIPT_MIMES), 'max:'.CapitalRequest::RECEIPT_MAX_KB]],
            [],
            ['receipt_file' => 'import receipt'],
        );

        $this->storeReceipt($capital, $request->file('receipt_file'));

        return $this->message('Receipt Updated successfully');
    }

    /**
     * @return array<string, mixed>
     */
    private function presentContribution(Capital $capital): array
    {
        return [
            'id' => $capital->id,
            'share_holder_id' => $capital->share_holder_id,
            'amount' => (float) $capital->amount,
            'pay_method' => $capital->pay_method,
            'receiving_account' => $capital->receiving_account,
            'receiving_account_label' => $capital->receivingAccountLabel(),
            'bank_account_id' => $capital->bank_account_id,
            'bank_account' => $capital->bankAccount?->name,
            'receipt_number' => $capital->receipt_number,
            'cheque_number' => $capital->cheque_number,
            'receipt_file_name' => $capital->receipt_file_name,
            'receipt_endpoint' => $capital->receipt_file ? "capital/capitals/{$capital->id}/receipt?v=".$capital->updated_at?->timestamp : null,
            'recorded_by' => $capital->recorder?->full_name,
            'contributed_at' => ($capital->contributed_at ?? $capital->created_at)?->format('Y-m-d H:i:s'),
            'journal_entry_id' => $capital->journal_entry_id,
            'journal_reference' => $capital->journalEntry?->reference,
            'share_transaction_reference' => $capital->shareTransactions->firstWhere('status', 'completed')?->reference,
            'created_at' => $capital->created_at?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * @return Collection<int, array{id: int, name: string, balance: float}>
     */
    private function bankBalances(int $companyId): Collection
    {
        return BankAccount::where('company_id', $companyId)->orderBy('id')->get()
            ->map(fn (BankAccount $account): array => ['id' => $account->id, 'name' => $account->name, 'balance' => $account->balance() + 0.0])
            ->values();
    }

    private function storeReceipt(Capital $capital, ?UploadedFile $file): void
    {
        if ($file !== null) {
            $capital->attachReceipt($file);
        }
    }
}
