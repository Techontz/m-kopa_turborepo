<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ReserveSettingController extends Controller
{
    public function edit(): View
    {
        return view('settings.reserve', ['company' => $this->company()]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'reserve' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $this->company()->update(['reserve_percent' => $validated['reserve']]);

        return back()->with('success', 'Reserve Setting Updated successfully');
    }
}
