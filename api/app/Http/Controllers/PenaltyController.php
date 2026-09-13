<?php

namespace App\Http\Controllers;

use App\Models\Penalty;
use App\Models\PenaltyPayment;
use App\Services\LoanService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PenaltyController extends Controller
{
    public function index(Request $request): View
    {
        $penalties = Penalty::query()
            ->where('company_id', $this->currentEmployee()->company_id)
            ->where('is_waived', false)
            ->whereColumn('paid_amount', '<', 'amount')
            ->when($this->branchFilter($request), fn (Builder $query, int $branchId) => $query->where('branch_id', $branchId))
            ->with(['customer', 'branch', 'loan'])
            ->orderBy('penalty_date')
            ->get();

        return view('penalties.index', [
            'penalties' => $penalties,
            'branches' => $this->companyBranches(),
        ]);
    }

    public function pay(Request $request, Penalty $penalty, LoanService $loanService): RedirectResponse
    {
        $request->validate(['penart_paid' => ['required', 'numeric', 'min:1']]);

        $amount = $request->float('penart_paid');
        $remaining = (float) $penalty->amount - (float) $penalty->paid_amount;

        if ($penalty->is_waived || $remaining <= 0) {
            return back()->with('error', 'Penarty is already cleared');
        }

        if ($amount > $remaining + 0.001) {
            return back()->with('error', 'Amount is greater than penarty amount ('.money($remaining).')');
        }

        $loanService->payPenalty($penalty, $amount, CarbonImmutable::today());

        return back()->with('success', 'Penarty Paid successfully');
    }

    public function waive(Penalty $penalty): RedirectResponse
    {
        $penalty->update(['is_waived' => true]);

        return back()->with('success', 'Penalty Removed successfully');
    }

    public function paid(Request $request): View
    {
        $payments = PenaltyPayment::query()
            ->whereHas('penalty', function (Builder $query) use ($request): void {
                $query->where('company_id', $this->currentEmployee()->company_id);
                if ($branchId = $this->branchFilter($request)) {
                    $query->where('branch_id', $branchId);
                }
            })
            ->when($request->filled('from'), fn (Builder $query) => $query->whereDate('paid_on', '>=', $request->date('from')->toDateString()))
            ->when($request->filled('to'), fn (Builder $query) => $query->whereDate('paid_on', '<=', $request->date('to')->toDateString()))
            ->with(['penalty.customer', 'penalty.branch'])
            ->latest('paid_on')
            ->get();

        return view('penalties.paid', [
            'payments' => $payments,
            'branches' => $this->companyBranches(),
        ]);
    }

    private function branchFilter(Request $request): ?int
    {
        return $request->filled('blanch_id') && $request->input('blanch_id') !== 'all' ? $request->integer('blanch_id') : null;
    }
}
