<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Enums\Account;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\CapitalRequest;
use App\Models\Capital;
use App\Models\ShareHolder;
use App\Services\Ledger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
                'name' => $holder->full_name,
                'total' => (float) $holder->capitals->sum('amount'),
                'capitals' => $holder->capitals->map(fn (Capital $capital): array => [
                    'id' => $capital->id,
                    'amount' => (float) $capital->amount,
                    'pay_method' => $capital->pay_method,
                    'receipt_number' => $capital->receipt_number,
                    'cheque_number' => $capital->cheque_number,
                    'receipt_file_name' => $capital->receipt_file_name,
                    'receipt_endpoint' => $capital->receipt_file ? "capital/capitals/{$capital->id}/receipt?v=".$capital->updated_at?->timestamp : null,
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
            $this->storeReceipt($capital, $request->file('receipt_file'));
        });

        return $this->message('Capital Added successfully', 201);
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

    private function storeReceipt(Capital $capital, ?UploadedFile $file): void
    {
        if ($file === null) {
            return;
        }

        $previous = $capital->receipt_file;
        $capital->update([
            'receipt_file' => $file->store("capital-receipts/{$capital->company_id}", Capital::DISK),
            'receipt_file_name' => mb_substr(basename($file->getClientOriginalName()), 0, 191),
        ]);

        if ($previous) {
            Storage::disk(Capital::DISK)->delete($previous);
        }
    }
}
