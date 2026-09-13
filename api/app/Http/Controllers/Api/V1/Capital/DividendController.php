<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\DividendDeclarationRequest;
use App\Http\Requests\Api\Capital\DividendPaymentRequest;
use App\Models\DividendAllocation;
use App\Models\DividendDeclaration;
use App\Services\DividendService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Capital → Dividends (Documents: ACCOUNT OVERVIEW "Dividend Account": Profit → Dividend, 70% → Principal
 * (reinvestment), 30% → shareholders by share percentage; the Dividend account is withdrawn by CASH or BANK).
 */
class DividendController extends ApiController
{
    public function __construct(private readonly DividendService $dividends) {}

    public function index(): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');

        $declarations = DividendDeclaration::where('company_id', $this->currentEmployee()->company_id)
            ->with(['allocations' => fn ($query) => $query->orderBy('id'), 'allocations.shareHolder', 'allocations.bankAccount', 'declaredBy'])
            ->orderByDesc('period')
            ->get();

        return response()->json(['data' => $declarations->map(fn (DividendDeclaration $declaration): array => [
            'id' => $declaration->id,
            'period' => $declaration->period->format('Y-m'),
            'profit_amount' => (float) $declaration->profit_amount,
            'reinvest_percent' => (float) $declaration->reinvest_percent,
            'reinvest_amount' => (float) $declaration->reinvest_amount,
            'dividend_percent' => (float) $declaration->dividend_percent,
            'dividend_amount' => (float) $declaration->dividend_amount,
            'paid_amount' => (float) $declaration->allocations->where('status', 'paid')->sum('amount'),
            'declared_by' => $declaration->declaredBy?->full_name,
            'date' => $declaration->created_at?->toDateString(),
            'allocations' => $declaration->allocations->map(fn (DividendAllocation $allocation): array => [
                'id' => $allocation->id,
                'share_holder' => $allocation->shareHolder?->full_name,
                'share_percent' => (float) $allocation->share_percent,
                'amount' => (float) $allocation->amount,
                'status' => $allocation->status,
                'pay_method' => $allocation->pay_method,
                'bank_account' => $allocation->bankAccount?->name,
                'reference' => $allocation->reference,
                'paid_at' => $allocation->paid_at?->toDateString(),
            ])->values(),
        ])->values()]);
    }

    /**
     * Figures for the declaration form: available profit, dividend balance, shareholder percentages and
     * the month-end distributable profit for the chosen period when the accounting close has run.
     */
    public function summary(Request $request): JsonResponse
    {
        $this->authorizeAny('capital.manage', 'capital.view');
        $request->validate(['period' => ['nullable', 'date_format:Y-m']]);

        $companyId = $this->currentEmployee()->company_id;
        $period = CarbonImmutable::createFromFormat('Y-m-d', ($request->input('period') ?: now()->subMonthNoOverflow()->format('Y-m')).'-01');

        return response()->json(['data' => [
            'period' => $period->format('Y-m'),
            'available_profit' => $this->dividends->availableProfit($companyId),
            'dividend_balance' => $this->dividends->dividendBalance($companyId),
            'period_profit' => $this->dividends->closedPeriodProfit($companyId, $period),
            'reinvest_percent' => DividendService::REINVEST_PERCENT,
            'dividend_percent' => DividendService::DIVIDEND_PERCENT,
            'shares' => $this->dividends->shares($companyId)->map(fn (array $share): array => [
                'id' => $share['share_holder']->id,
                'name' => $share['share_holder']->name,
                'capital' => $share['capital'],
                'percent' => $share['percent'],
            ])->values(),
        ]]);
    }

    public function store(DividendDeclarationRequest $request): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $declaration = $this->dividends->declare(
            $this->currentEmployee()->company_id,
            CarbonImmutable::createFromFormat('Y-m-d', $request->string('period')->toString().'-01'),
            $request->float('profit_amount'),
            $this->currentEmployee(),
        );

        return $this->message('Dividend Declared successfully', 201, ['data' => ['id' => $declaration->id]]);
    }

    public function pay(DividendPaymentRequest $request, DividendAllocation $allocation): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $this->dividends->pay(
            $allocation->load('shareHolder'),
            $request->string('pay_method')->toString(),
            $request->filled('bank_account_id') ? $request->integer('bank_account_id') : null,
            $request->input('reference'),
            $this->currentEmployee(),
        );

        return $this->message('Dividend Paid successfully');
    }
}
