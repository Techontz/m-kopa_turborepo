<?php

namespace App\Services;

use App\Enums\Account;
use App\Models\Employee;
use App\Models\ExpenseRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Expense approval and payment (Documents: ACCOUNT OVERVIEW + handwritten "Finance – Expenses" note).
 *
 *  - Branch expenses ("matumizi madogo ya branch") are approved by Finance (expenses.approve_branch)
 *    up to the company's expense_approval_limit; larger ones and all HQ expenses need Admin (expenses.approve_hq).
 *  - Branch expenses are paid from the branch INTEREST A/C; HQ expenses from HQ (company) accounts and
 *    never from branch interest; bank expenses from the chosen bank account.
 *  - Every expense is posted Dr EXPENSES (tagged with branch + expense type) / Cr source account.
 */
class ExpenseApproval
{
    public const SCOPES = ['branch', 'hq', 'bank'];

    public function __construct(private readonly Ledger $ledger) {}

    /**
     * Permissions of which any one allows approving this request for the given amount.
     *
     * Inferred: Admin (approve_hq) may also approve small branch expenses; bank-account expenses are
     * HQ money and follow the HQ rule.
     *
     * @return list<string>
     */
    public function requiredPermissions(ExpenseRequest $expenseRequest, float $amount): array
    {
        if ($expenseRequest->scope === 'branch' && $amount <= $this->limit($expenseRequest->company_id)) {
            return ['expenses.approve_branch', 'expenses.approve_hq'];
        }

        return ['expenses.approve_hq'];
    }

    /**
     * Per-request memo of company approval limits.
     *
     * @var array<int, float>
     */
    private static array $limits = [];

    public function limit(int $companyId): float
    {
        return self::$limits[$companyId] ??= (float) DB::table('companies')->where('id', $companyId)->value('expense_approval_limit');
    }

    public function setLimit(int $companyId, float $limit): void
    {
        DB::table('companies')->where('id', $companyId)->update(['expense_approval_limit' => $limit, 'updated_at' => now()]);
        unset(self::$limits[$companyId]);
    }

    /**
     * Accounts an HQ expense may be paid from.
     *
     * @return list<Account>
     */
    public static function hqSourceAccounts(): array
    {
        return [Account::Company, ...Account::hqAccounts()];
    }

    /**
     * Resolve the ledger source of the payment.
     *
     * @return array{account: Account, branch?: int|null, bank?: int|null}
     */
    public function source(ExpenseRequest $expenseRequest, ?Account $hqAccount = null): array
    {
        return match ($expenseRequest->scope) {
            'branch' => ['account' => Account::Interest, 'branch' => $expenseRequest->branch_id],
            'bank' => ['account' => Account::Bank, 'bank' => $expenseRequest->bank_account_id],
            default => ['account' => $hqAccount ?? Account::Company],
        };
    }

    /**
     * Approve and pay a pending request.
     *
     * @throws ValidationException when already processed or the source account lacks funds
     */
    public function accept(ExpenseRequest $expenseRequest, Employee $approver, float $amount, ?string $comment, ?Account $hqAccount = null): ExpenseRequest
    {
        return DB::transaction(function () use ($expenseRequest, $approver, $amount, $comment, $hqAccount): ExpenseRequest {
            $expenseRequest = ExpenseRequest::whereKey($expenseRequest->id)->lockForUpdate()->firstOrFail();

            if ($expenseRequest->status !== 'pending') {
                throw ValidationException::withMessages(['req_amount' => 'Expenses already accepted']);
            }

            $source = $this->source($expenseRequest, $hqAccount);
            $available = $this->ledger->balance($expenseRequest->company_id, $source['account'], $source['branch'] ?? null, $source['bank'] ?? null);

            if ($available < $amount) {
                throw ValidationException::withMessages(['req_amount' => 'Insufficient balance in '.$source['account']->label()]);
            }

            $entry = $this->ledger->transfer(
                $expenseRequest->company_id,
                $source,
                ['account' => Account::OperatingExpense, 'branch' => $expenseRequest->branch_id, 'expense_type' => $expenseRequest->expense_type_id],
                $amount,
                'Expenses: '.$expenseRequest->expenseType?->name,
                $expenseRequest,
            );

            $expenseRequest->update([
                'amount' => $amount,
                'comment' => $comment ?? $expenseRequest->comment,
                'status' => 'accepted',
                'paid_from_account' => $source['account']->value,
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'journal_entry_id' => $entry->id,
            ]);

            return $expenseRequest;
        });
    }
}
