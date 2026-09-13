<?php

namespace App\Http\Controllers\Api\V1\Capital;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Capital\ShareHolderRequest;
use App\Models\ShareHolder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

        $holder = DB::transaction(function () use ($request): ShareHolder {
            $holder = ShareHolder::create($request->shareHolderData() + ['company_id' => $this->currentEmployee()->company_id]);
            $this->storePhoto($holder, $request->file('passport_photo'));

            return $holder;
        });

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
        $this->storePhoto($shareHolder, $request->file('passport_photo'));

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
        if ($shareHolder->passport_photo) {
            Storage::disk(ShareHolder::DISK)->delete($shareHolder->passport_photo);
        }

        return $this->message('Share Holder Deleted successfully');
    }

    /**
     * Passport-size photo, streamed from private storage to users who may see share holders.
     */
    public function photo(ShareHolder $shareHolder): StreamedResponse
    {
        $this->authorizeAny('capital.view', 'capital.manage');

        abort_unless($shareHolder->passport_photo && Storage::disk(ShareHolder::DISK)->exists($shareHolder->passport_photo), 404);

        return Storage::disk(ShareHolder::DISK)->response($shareHolder->passport_photo, null, ['Cache-Control' => 'private, max-age=300']);
    }

    /**
     * Store a new passport photo and remove the one it replaces.
     */
    private function storePhoto(ShareHolder $holder, ?UploadedFile $photo): void
    {
        if ($photo === null) {
            return;
        }

        $previous = $holder->passport_photo;
        $holder->update(['passport_photo' => $photo->store("share-holders/{$holder->company_id}", ShareHolder::DISK)]);

        if ($previous) {
            Storage::disk(ShareHolder::DISK)->delete($previous);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function present(ShareHolder $holder): array
    {
        return [
            'id' => $holder->id,
            'first_name' => $holder->first_name,
            'middle_name' => $holder->middle_name,
            'last_name' => $holder->last_name,
            'name' => $holder->full_name,
            'mobile' => $holder->mobile,
            'email' => $holder->email,
            'gender' => $holder->gender,
            'date_of_birth' => $holder->date_of_birth?->toDateString(),
            'photo_endpoint' => $holder->passport_photo ? "capital/share-holders/{$holder->id}/photo?v=".$holder->updated_at?->timestamp : null,
        ];
    }
}
