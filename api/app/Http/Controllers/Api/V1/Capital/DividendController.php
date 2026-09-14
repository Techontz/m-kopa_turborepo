<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\DividendDeclarationRequest;
use App\Http\Requests\Api\Capital\DividendPayAllRequest;
use App\Http\Requests\Api\Capital\DividendPaymentRequest;
use App\Models\DividendAllocation;
use App\Models\DividendDeclaration;
use App\Models\DividendPayment;
use App\Services\Dividends\DividendMath;
use App\Services\DividendService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Capital → Dividends (Documents: ACCOUNT OVERVIEW "Dividend Account": Profit → Dividend, split into Principal
 * Reinvestment and the Shareholder Dividend Pool by the company's Dividend Settings; the pool is split by
 * share-register ownership; the Dividend account is paid out by CASH or BANK, in full or in parts).
 *
 * Reading needs capital.view or capital.manage; declaring and paying need capital.manage; reversing a payment needs
 * capital.manage and accounting.reverse. Every record is scoped to the signed-in employee's company.
 */
class DividendController extends ApiController
{
    public function __construct(private readonly DividendService $dividends) {}

    /**
     * Dividend Declaration History.
     */
    public function index(): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');

        $declarations = DividendDeclaration::where('company_id', $this->companyId())
            ->with(['declaredBy', 'journalEntry'])
            ->withCount('allocations')
            ->withSum(['payments as paid_total' => fn ($query) => $query->where('dividend_payments.status', DividendPayment::STATUS_POSTED)], 'dividend_payments.amount')
            ->orderByDesc('period')
            ->get();

        return response()->json(['data' => $declarations->map(fn (DividendDeclaration $declaration): array => $this->declarationData($declaration))->values()]);
    }

    /**
     * Summary cards: Profit Available / pool / reinvestment for the selected period, plus company totals.
     */
    public function summary(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $period = $this->period($request);
        $companyId = $this->companyId();
        $preview = $this->dividends->preview($companyId, $period);

        return response()->json(['data' => [
            'period' => $preview['period'],
            'period_label' => $preview['period_label'],
            'profit_available' => $preview['profit_available'],
            'profit_source' => $preview['profit_source'],
            'profit_note' => $preview['profit_note'],
            'period_closed' => $preview['period_closed'],
            'period_profit' => $preview['period_profit'],
            'profit_account_balance' => $preview['profit_account_balance'],
            'dividend_percent' => $preview['dividend_percent'],
            'reinvest_percent' => $preview['reinvest_percent'],
            'dividend_pool' => $preview['dividend_pool'],
            'reinvestment_amount' => $preview['reinvestment_amount'],
            'already_declared' => $preview['already_declared'],
            'declaration_id' => $preview['declaration_id'],
        ] + $this->dividends->totals($companyId)]);
    }

    /**
     * Profit Available for a period (computed by the server; never typed).
     */
    public function availableProfit(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');

        return response()->json(['data' => $this->dividends->availableProfit($this->companyId(), $this->period($request))]);
    }

    /**
     * Declaration preview: profit, percentages, pool, reinvestment and each shareholder's entitlement.
     */
    public function preview(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');

        return response()->json(['data' => $this->dividends->preview($this->companyId(), $this->period($request))]);
    }

    public function store(DividendDeclarationRequest $request): JsonResponse
    {
        $declaration = $this->dividends->declare(
            $this->companyId(),
            CarbonImmutable::createFromFormat('Y-m-d', $request->string('period')->toString().'-01'),
            $this->currentEmployee(),
        );

        return $this->message('Dividend Declared successfully', 201, ['data' => [
            'id' => $declaration->id,
            'profit_amount' => (float) $declaration->profit_amount,
            'dividend_amount' => (float) $declaration->dividend_amount,
            'reinvest_amount' => (float) $declaration->reinvest_amount,
        ]]);
    }

    /**
     * Shareholder Dividend Allocation table of one declaration.
     */
    public function allocations(DividendDeclaration $declaration): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $this->ensureCompany($declaration->company_id);

        $allocations = $declaration->allocations()
            ->with('shareHolder')
            ->withMax(['payments as last_payment_at' => fn ($query) => $query->where('status', DividendPayment::STATUS_POSTED)], 'paid_at')
            ->withSum(['payments as posted_total' => fn ($query) => $query->where('status', DividendPayment::STATUS_POSTED)], 'amount')
            ->withCount('payments')
            ->orderBy('id')
            ->get();

        return response()->json([
            'declaration' => $this->declarationData($declaration->loadMissing(['declaredBy', 'journalEntry'])->loadCount('allocations')->loadSum(['payments as paid_total' => fn ($query) => $query->where('dividend_payments.status', DividendPayment::STATUS_POSTED)], 'dividend_payments.amount')),
            'data' => $allocations->map(fn (DividendAllocation $allocation): array => $this->allocationData($allocation))->values(),
            'totals' => collect($this->dividends->payAllPreview($declaration))->except('rows')->all(),
        ]);
    }

    /**
     * PAY ALL OUTSTANDING preview of one declaration: shareholders awaiting payment, their balances and the total
     * (computed from the posted payments by the server).
     */
    public function payAllPreview(DividendDeclaration $declaration): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $this->ensureCompany($declaration->company_id);

        return response()->json(['data' => $this->dividends->payAllPreview($declaration)]);
    }

    /**
     * PAY ALL OUTSTANDING: pays every remaining balance of the declaration in one transaction (one payment and journal
     * entry per shareholder, grouped in a batch).
     */
    public function payAll(DividendPayAllRequest $request, DividendDeclaration $declaration): JsonResponse
    {
        $this->ensureCompany($declaration->company_id);

        $result = $this->dividends->payAll(
            $declaration,
            $request->string('expected_total')->toString(),
            $request->string('pay_method')->toString(),
            $request->filled('bank_account_id') ? $request->integer('bank_account_id') : null,
            $request->input('reference'),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
        );
        $batch = $result['batch'];

        return $this->message(
            $result['created'] ? "Dividends Paid successfully to {$batch->payments_count} shareholder(s)" : 'Dividend batch already recorded',
            $result['created'] ? 201 : 200,
            ['data' => [
                'id' => $batch->id,
                'batch_reference' => $batch->batch_reference,
                'total_amount' => (float) $batch->total_amount,
                'payments_count' => $batch->payments_count,
                'payment_ids' => $batch->payments()->orderBy('id')->pluck('id')->all(),
                'created' => $result['created'],
                'totals' => collect($this->dividends->payAllPreview($declaration))->except('rows')->all(),
            ]],
        );
    }

    /**
     * Payment history of one shareholder entitlement.
     */
    public function allocationPayments(DividendAllocation $allocation): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $this->ensureCompany($allocation->company_id);

        $allocation->load('shareHolder')
            ->loadMax(['payments as last_payment_at' => fn ($query) => $query->where('status', DividendPayment::STATUS_POSTED)], 'paid_at')
            ->loadSum(['payments as posted_total' => fn ($query) => $query->where('status', DividendPayment::STATUS_POSTED)], 'amount')
            ->loadCount('payments');

        return response()->json([
            'allocation' => $this->allocationData($allocation),
            'data' => $this->paymentRows(DividendPayment::where('dividend_allocation_id', $allocation->id)),
        ]);
    }

    /**
     * Company dividend Payment History (optionally one declaration).
     */
    public function payments(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $request->validate(['declaration_id' => ['nullable', 'integer']]);

        $query = DividendPayment::where('company_id', $this->companyId())
            ->when($request->filled('declaration_id'), fn ($query) => $query->whereHas('allocation', fn ($allocation) => $allocation->where('dividend_declaration_id', $request->integer('declaration_id'))));

        return response()->json(['data' => $this->paymentRows($query)]);
    }

    public function pay(DividendPaymentRequest $request, DividendAllocation $allocation): JsonResponse
    {
        $this->ensureCompany($allocation->company_id);

        $result = $this->dividends->pay(
            $allocation,
            $request->string('amount')->toString(),
            $request->string('pay_method')->toString(),
            $request->filled('bank_account_id') ? $request->integer('bank_account_id') : null,
            $request->input('reference'),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
        );

        $allocation->refresh();
        $paid = $this->dividends->postedCents($allocation);
        $entitlement = DividendMath::toCents((string) $allocation->amount);

        return $this->message($result['created'] ? 'Dividend Paid successfully' : 'Dividend payment already recorded', $result['created'] ? 201 : 200, ['data' => [
            'id' => $result['payment']->id,
            'amount' => (float) $result['payment']->amount,
            'created' => $result['created'],
            'allocation' => [
                'id' => $allocation->id,
                'paid_amount' => DividendMath::centsToFloat($paid),
                'balance' => DividendMath::centsToFloat(max(0, $entitlement - $paid)),
                'status' => DividendAllocation::statusFor($entitlement, $paid),
            ],
        ]]);
    }

    public function reverse(Request $request, DividendPayment $payment): JsonResponse
    {
        $this->authorizeAny('capital.manage');
        $this->authorizeAny('accounting.reverse');
        $this->ensureCompany($payment->company_id);

        $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:500']]);

        $this->dividends->reversePayment($payment, $validated['reason'], $this->currentEmployee());

        return $this->message('Dividend Payment Reversed successfully');
    }

    private function companyId(): int
    {
        return (int) $this->currentEmployee()->company_id;
    }

    private function ensureCompany(int|string|null $companyId): void
    {
        abort_unless((int) $companyId === $this->companyId(), 404);
    }

    private function period(Request $request): CarbonImmutable
    {
        $request->validate(['period' => ['nullable', 'date_format:Y-m']]);
        $value = $request->input('period') ?: now()->format('Y-m');

        $period = CarbonImmutable::createFromFormat('!Y-m-d', $value.'-01');
        if ($period === false || $period->format('Y-m') !== $value) {
            throw ValidationException::withMessages(['period' => 'The period must be a month (YYYY-MM).']);
        }

        return $period;
    }

    /**
     * @return array<string, mixed>
     */
    private function declarationData(DividendDeclaration $declaration): array
    {
        $paid = DividendMath::toCents((string) ($declaration->paid_total ?? 0));
        $pool = DividendMath::toCents((string) $declaration->dividend_amount);
        $outstanding = $pool - $paid;

        return [
            'id' => $declaration->id,
            'period' => $declaration->period->format('Y-m'),
            'period_label' => $declaration->periodLabel(),
            'profit_amount' => (float) $declaration->profit_amount,
            'profit_source' => $declaration->profit_source,
            'dividend_percent' => (float) $declaration->dividend_percent,
            'dividend_amount' => (float) $declaration->dividend_amount,
            'reinvest_percent' => (float) $declaration->reinvest_percent,
            'reinvest_amount' => (float) $declaration->reinvest_amount,
            'total_shares' => $declaration->total_shares,
            'as_of_date' => $declaration->as_of_date?->toDateString(),
            'shareholders' => (int) ($declaration->allocations_count ?? 0),
            'paid_amount' => DividendMath::centsToFloat($paid),
            'outstanding_amount' => DividendMath::centsToFloat($outstanding),
            'status' => $outstanding <= 0 ? 'FULLY PAID' : ($paid > 0 ? 'PARTIALLY PAID' : 'OPEN'),
            'declared_by' => $declaration->declaredBy?->full_name,
            'declared_at' => ($declaration->declared_at ?? $declaration->created_at)?->toDateTimeString(),
            'journal_reference' => $declaration->journalEntry?->reference,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function allocationData(DividendAllocation $allocation): array
    {
        $entitlement = DividendMath::toCents((string) $allocation->amount);
        $paid = DividendMath::toCents((string) ($allocation->posted_total ?? 0));
        $status = DividendAllocation::statusFor($entitlement, $paid);

        return [
            'id' => $allocation->id,
            'declaration_id' => $allocation->dividend_declaration_id,
            'share_holder_id' => $allocation->share_holder_id,
            'share_holder' => $allocation->shareHolder?->full_name,
            'shares_held' => $allocation->shares_held,
            'total_shares' => $allocation->total_shares,
            'ownership_percent' => (float) $allocation->share_percent,
            'contribution_total' => $allocation->contribution_total === null ? null : (float) $allocation->contribution_total,
            'entitlement' => (float) $allocation->amount,
            'paid_amount' => DividendMath::centsToFloat($paid),
            'balance' => DividendMath::centsToFloat(max(0, $entitlement - $paid)),
            'status' => $status,
            'status_label' => DividendAllocation::STATUS_LABELS[$status],
            'last_payment_date' => $allocation->last_payment_at === null ? null : CarbonImmutable::parse($allocation->last_payment_at)->toDateString(),
            'payments_count' => (int) ($allocation->payments_count ?? 0),
        ];
    }

    /**
     * @param  Builder<DividendPayment>  $query
     * @return list<array<string, mixed>>
     */
    private function paymentRows($query): array
    {
        return $query->with(['shareHolder', 'bankAccount', 'paidBy', 'reversedBy', 'journalEntry', 'reversalJournalEntry', 'allocation.declaration', 'batch'])
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (DividendPayment $payment): array => [
                'id' => $payment->id,
                'allocation_id' => $payment->dividend_allocation_id,
                'declaration_id' => $payment->allocation?->dividend_declaration_id,
                'period' => $payment->allocation?->declaration?->period->format('Y-m'),
                'period_label' => $payment->allocation?->declaration?->periodLabel(),
                'share_holder' => $payment->shareHolder?->full_name,
                'amount' => (float) $payment->amount,
                'pay_method' => $payment->pay_method,
                'account' => $payment->accountLabel(),
                'bank_account_id' => $payment->bank_account_id,
                'reference' => $payment->reference,
                'paid_at' => $payment->paid_at?->toDateTimeString(),
                'paid_by' => $payment->paidBy?->full_name,
                'journal_entry_id' => $payment->journal_entry_id,
                'journal_reference' => $payment->journalEntry?->reference,
                'status' => $payment->status,
                'batch_id' => $payment->dividend_payment_batch_id,
                'batch_reference' => $payment->batch?->batch_reference,
                'reversed_at' => $payment->reversed_at?->toDateTimeString(),
                'reversed_by' => $payment->reversedBy?->full_name,
                'reversal_reason' => $payment->reversal_reason,
                'reversal_reference' => $payment->reversalJournalEntry?->reference,
            ])
            ->values()
            ->all();
    }
}
