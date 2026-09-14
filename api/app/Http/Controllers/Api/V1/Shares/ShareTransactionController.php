<?php

namespace App\Http\Controllers\Api\V1\Shares;

use App\Enums\ShareTransactionType;
use App\Http\Requests\Api\Shares\ShareAdjustmentRequest;
use App\Http\Requests\Api\Shares\ShareCancellationRequest;
use App\Http\Requests\Api\Shares\ShareIssuanceRequest;
use App\Http\Requests\Api\Shares\ShareReversalRequest;
use App\Http\Requests\Api\Shares\ShareTransferRequest;
use App\Http\Resources\Api\V1\Shares\ShareTransactionResource;
use App\Models\ShareHolder;
use App\Models\ShareTransaction;
use App\Services\Reports\ShareReports;
use App\Services\Shares\ShareIssuance;
use App\Services\Shares\ShareRegister;
use App\Services\Shares\ShareTransfers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Shares → Share Transactions, Issue Shares, Transfer Shares, cancellations, adjustments and reversals.
 */
class ShareTransactionController extends SharesController
{
    public function __construct(
        private readonly ShareRegister $register,
        private readonly ShareIssuance $issuance,
        private readonly ShareTransfers $transfers,
        private readonly ShareReports $reports,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('shares.view');
        $request->validate([
            'type' => ['nullable', Rule::enum(ShareTransactionType::class)],
            'share_holder_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:completed,reversed'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $rows = $this->reports->transactions(
            $this->companyId(),
            $request->filled('type') ? [ShareTransactionType::from($request->string('type')->toString())] : [],
            $request->filled('share_holder_id') ? $request->integer('share_holder_id') : null,
            $request->input('status'),
            $this->date($request, 'from'),
            $this->date($request, 'to'),
        );

        return response()->json(['data' => ShareTransactionResource::collection($rows)]);
    }

    public function show(ShareTransaction $shareTransaction): JsonResponse
    {
        $this->authorizeAny('shares.view');
        $this->ensureCompany($shareTransaction);

        return response()->json(['data' => new ShareTransactionResource($shareTransaction->load(ShareReports::TRANSACTION_RELATIONS))]);
    }

    /**
     * Supporting document from private storage.
     */
    public function document(ShareTransaction $shareTransaction): StreamedResponse
    {
        $this->authorizeAny('shares.view');
        $this->ensureCompany($shareTransaction);

        abort_unless($shareTransaction->document_path && Storage::disk(ShareTransaction::DISK)->exists($shareTransaction->document_path), 404);

        return Storage::disk(ShareTransaction::DISK)->response($shareTransaction->document_path, $shareTransaction->document_name, ['Cache-Control' => 'private, max-age=300'], 'inline');
    }

    public function issue(ShareIssuanceRequest $request): JsonResponse
    {
        $result = $this->issuance->issue(
            $this->holder($request->integer('share_holder_id')),
            $request->integer('shares'),
            $request->string('type')->toString(),
            (string) $request->input('payment_treatment', ''),
            $request->filled('price_per_share') ? $request->float('price_per_share') : null,
            $this->date($request, 'issue_date'),
            [
                'pay_method' => $request->input('pay_method'),
                'bank_account_id' => $request->filled('bank_account_id') ? $request->integer('bank_account_id') : null,
                'receipt_number' => $request->input('receipt_number'),
                'cheque_number' => $request->input('cheque_number'),
                'capital_id' => $request->filled('capital_id') ? $request->integer('capital_id') : null,
            ],
            $request->input('notes'),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
            $request->file('document'),
        );

        return $this->respond($result, 'Shares Issued successfully', 'Shares were already issued');
    }

    public function transfer(ShareTransferRequest $request): JsonResponse
    {
        $result = $this->transfers->transfer(
            $this->holder($request->integer('from_share_holder_id')),
            $this->holder($request->integer('to_share_holder_id')),
            $request->integer('shares'),
            $request->filled('consideration_per_share') ? $request->float('consideration_per_share') : null,
            $this->date($request, 'transfer_date'),
            $request->input('notes'),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
            $request->file('document'),
        );

        return $this->respond($result, 'Shares Transferred successfully', 'Shares were already transferred');
    }

    public function cancel(ShareCancellationRequest $request): JsonResponse
    {
        $result = $this->register->cancel(
            $this->holder($request->integer('share_holder_id')),
            $request->integer('shares'),
            $this->date($request, 'transaction_date'),
            $request->string('reason')->toString(),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
            $request->file('document'),
        );

        return $this->respond($result, 'Shares Cancelled successfully', 'Shares were already cancelled');
    }

    public function adjust(ShareAdjustmentRequest $request): JsonResponse
    {
        $result = $this->register->adjust(
            $this->holder($request->integer('share_holder_id')),
            $request->string('direction')->toString(),
            $request->integer('shares'),
            $request->string('reason')->toString(),
            $this->currentEmployee(),
            $request->input('idempotency_key'),
        );

        return $this->respond($result, 'Shares Adjusted successfully', 'The adjustment was already recorded');
    }

    public function reverse(ShareReversalRequest $request, ShareTransaction $shareTransaction): JsonResponse
    {
        $this->ensureCompany($shareTransaction);

        $result = $this->register->reverse($shareTransaction, $request->string('reason')->toString(), $this->currentEmployee());

        return $this->respond($result, 'Share Transaction Reversed successfully', 'Share transaction was already reversed');
    }

    private function holder(int $id): ShareHolder
    {
        return ShareHolder::where('company_id', $this->companyId())->findOrFail($id);
    }

    /**
     * @param  array{transaction: ShareTransaction, created: bool}  $result
     */
    private function respond(array $result, string $created, string $replayed): JsonResponse
    {
        return $this->message(
            $result['created'] ? $created : $replayed,
            $result['created'] ? 201 : 200,
            ['data' => new ShareTransactionResource($result['transaction']->load(ShareReports::TRANSACTION_RELATIONS))],
        );
    }
}
