<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PenaltySettingController extends Controller
{
    /**
     * Live "Calculation Type" option values mapped to companies.penalty_type.
     *
     * @var array<string, string>
     */
    public const TYPES = ['PERCENTAGE VALUE' => 'percentage', 'MONEY VALUE' => 'money'];

    public function edit(): View
    {
        return view('settings.penalty', ['company' => $this->company()]);
    }

    /**
     * The live row "delete" removes the setting; here it submits a zero amount, which disables penalties.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'action_penart' => ['required', 'in:'.implode(',', array_keys(self::TYPES))],
            'penart' => ['required', 'numeric', 'min:0'],
        ]);

        $this->company()->update([
            'penalty_type' => self::TYPES[$validated['action_penart']],
            'penalty_value' => $validated['penart'],
        ]);

        return back()->with('success', 'Penart Setting Updated successfully');
    }
}
