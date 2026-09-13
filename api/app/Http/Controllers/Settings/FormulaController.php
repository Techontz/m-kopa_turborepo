<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\InterestFormula;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

/**
 * Interest formulas are system-wide (the table has no company_id); enabling one
 * makes it selectable when defining loan categories.
 */
class FormulaController extends Controller
{
    public function index(): View
    {
        $formulas = InterestFormula::orderBy('id')->get();

        return view('settings.formulas', [
            'formulas' => $formulas,
            'enabledFormulas' => $formulas->where('is_enabled', true)->values(),
        ]);
    }

    public function enable(InterestFormula $formula): RedirectResponse
    {
        $formula->update(['is_enabled' => true]);

        return back()->with('success', 'Interest Formular Added successfully');
    }

    public function disable(InterestFormula $formula): RedirectResponse
    {
        $formula->update(['is_enabled' => false]);

        return back()->with('success', 'Interest Formular Deleted successfully');
    }
}
