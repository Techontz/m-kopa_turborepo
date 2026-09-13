<?php

namespace App\Http\Controllers\Agent;

use App\Http\Controllers\Controller;
use App\Models\AgentTransaction;
use App\Models\PaymentMode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PaymentModeController extends Controller
{
    public function index(): View
    {
        return view('agent.payment-modes', [
            'modes' => PaymentMode::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate(['pay_mode' => ['required', 'string', 'max:255']]);

        PaymentMode::create(['company_id' => $this->currentEmployee()->company_id, 'name' => $data['pay_mode']]);

        return back()->with('success', 'Mode of payment Registered successfully');
    }

    public function destroy(PaymentMode $paymentMode): RedirectResponse
    {
        if (AgentTransaction::where('payment_mode_id', $paymentMode->id)->exists()) {
            return back()->with('error', 'Mode of payment has transactions and cannot be deleted');
        }

        $paymentMode->delete();

        return back()->with('success', 'Mode of payment Deleted successfully');
    }
}
