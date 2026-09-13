<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Capital\ShareHolderRequest;
use App\Models\ShareHolder;
use Illuminate\Http\JsonResponse;

/**
 * Capital → Share Holders (live admin/shareHolder). Documents: only capital-privileged users (super admin) see capital.
 */
class ShareHolderController extends ApiController
{
    public function index(): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        return response()->json(['data' => ShareHolder::where('company_id', $this->currentEmployee()->company_id)
            ->orderBy('id')
            ->get()
            ->map(fn (ShareHolder $holder): array => $this->present($holder))]);
    }

    public function store(ShareHolderRequest $request): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $holder = ShareHolder::create($request->shareHolderData() + ['company_id' => $this->currentEmployee()->company_id]);

        return $this->message('Share Holder Registered successfully', 201, ['data' => $this->present($holder)]);
    }

    public function show(ShareHolder $shareHolder): JsonResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        return response()->json(['data' => $this->present($shareHolder)]);
    }

    public function update(ShareHolderRequest $request, ShareHolder $shareHolder): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        $shareHolder->update($request->shareHolderData());

        return $this->message('Share Holder Updated successfully', 200, ['data' => $this->present($shareHolder)]);
    }

    /**
     * Share holders with capital or dividends are kept: their ledger entries remain.
     */
    public function destroy(ShareHolder $shareHolder): JsonResponse
    {
        $this->authorizeAny('capital.manage');

        if ($shareHolder->capitals()->exists() || $shareHolder->dividendAllocations()->exists()) {
            return $this->message('Share Holder has capital and cannot be deleted', 422);
        }

        $shareHolder->delete();

        return $this->message('Share Holder Deleted successfully');
    }

    /**
     * @return array<string, mixed>
     */
    private function present(ShareHolder $holder): array
    {
        return [
            'id' => $holder->id,
            'name' => $holder->name,
            'mobile' => $holder->mobile,
            'email' => $holder->email,
            'gender' => $holder->gender,
            'date_of_birth' => $holder->date_of_birth?->toDateString(),
        ];
    }
}
