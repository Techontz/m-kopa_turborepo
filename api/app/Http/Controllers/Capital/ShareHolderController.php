<?php

namespace App\Http\Controllers\Capital;

use App\Http\Controllers\Controller;
use App\Http\Requests\Capital\ShareHolderRequest;
use App\Models\ShareHolder;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ShareHolderController extends Controller
{
    public function index(): View
    {
        return view('capital.share-holders', [
            'shareHolders' => ShareHolder::where('company_id', $this->employee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(ShareHolderRequest $request): RedirectResponse
    {
        ShareHolder::create($request->shareHolderData() + ['company_id' => $this->employee()->company_id]);

        return back()->with('success', 'Share Holder Registered successfully');
    }

    public function update(ShareHolderRequest $request, ShareHolder $shareHolder): RedirectResponse
    {
        $shareHolder->update($request->shareHolderData());

        return back()->with('success', 'Share Holder Updated successfully');
    }

    /**
     * Share holders with capital contributions are kept: deleting them would cascade the
     * capital rows while their ledger entries remain.
     */
    public function destroy(ShareHolder $shareHolder): RedirectResponse
    {
        if ($shareHolder->capitals()->exists()) {
            return back()->with('error', 'Share Holder has capital and cannot be deleted');
        }

        $shareHolder->delete();

        return back()->with('success', 'Share Holder Deleted successfully');
    }
}
