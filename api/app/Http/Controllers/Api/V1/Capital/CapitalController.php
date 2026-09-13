<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\CapitalRequest;
use App\Models\Capital;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Capital → Add Capitals (live admin/capital). Documents (ACCOUNT OVERVIEW "Capital Account", handwritten note):
 * capital is added by the super admin and posted Dr Company (cash) / Cr Capital; only capital.view users see it.
 */
class CapitalController extends ApiController
{
    public function __construct(private readonly Ledger $ledger) {}

    public function index(): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        $companyId = $this->currentEmployee()->company_id;

        $holders = ShareHolder::where('company_id', $companyId)
            ->with(['capitals' => fn ($query) => $query->orderBy('id')])
            ->orderBy('id')
            ->get();

        return response()->json(['data' => [
            'share_holders' => $holders->map(fn (ShareHolder $holder): array => [
                'id' => $holder->id,
                'name' => $holder->name,
                'total' => (float) $holder->capitals->sum('amount'),
                'capitals' => $holder->capitals->map(fn (Capital $capital): array => [
                    'id' => $capital->id,
                    'amount' => (float) $capital->amount,
                    'pay_method' => $capital->pay_method,
                    'receipt_number' => $capital->receipt_number,
                    'cheque_number' => $capital->cheque_number,
                    'created_at' => $capital->created_at?->format('Y-m-d H:i:s'),
                ])->values(),
            ])->values(),
            'share_holder_capital' => (float) Capital::where('company_id', $companyId)->sum('amount'),
            'company_capital' => $this->ledger->balance($companyId, Account::Company) + 0.0,
            'capital_account' => $this->ledger->balance($companyId, Account::Capital, allBranches: true) + 0.0,
        ]]);
    }

    public function store(CapitalRequest $request): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $companyId = $this->currentEmployee()->company_id;

        DB::transaction(function () use ($request, $companyId): void {
            $capital = Capital::create([
                'company_id' => $companyId,
                'share_holder_id' => $request->integer('share_id'),
                'amount' => $request->float('amount'),
                'pay_method' => $request->string('pay_method')->toString(),
                'receipt_number' => $request->input('recept'),
                'cheque_number' => $request->input('chaque_no'),
            ]);

            $this->ledger->transfer($companyId, ['account' => Account::Capital], ['account' => Account::Company], $request->float('amount'), 'CAPITAL', $capital);
        });

        return $this->message('Capital Added successfully', 201);
    }
}
