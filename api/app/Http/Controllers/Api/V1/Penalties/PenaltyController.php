<?php

namespace App\Http\Controllers\Api\V1\Penalties;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Payments\PayPenaltyRequest;
use App\Models\AuditLog;
use App\Models\Penalty;
use App\Models\PenaltyPayment;
use App\Services\LoanService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Penarty → Penarty List (live admin/get_penart_list) and Paid Penarty (live admin/penart_paid_list).
 */
class PenaltyController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('penalties.manage');
        $this->normaliseBranchFilter($request);

        $query = $this->scoped(Penalty::query())
            ->where('is_waived', false)
            ->whereColumn('paid_amount', '<', 'amount')
            ->with(['customer', 'branch', 'loan'])
            ->orderBy('penalty_date');
        $this->applyFilters($query, $request);

        return response()->json(['data' => $query->get()->map(fn (Penalty $penalty): array => [
            'id' => $penalty->id,
            'customer_id' => $penalty->customer_id,
            'customer' => $penalty->customer?->full_name,
            'branch_id' => $penalty->branch_id,
            'branch' => $penalty->branch?->name,
            'loan_id' => $penalty->loan_id,
            'loan_amount' => (float) ($penalty->loan?->total_payable ?? 0),
            'amount' => (float) $penalty->amount,
            'paid_amount' => (float) $penalty->paid_amount,
            'remaining' => round((float) $penalty->amount - (float) $penalty->paid_amount, 2),
            'penalty_date' => $penalty->penalty_date->toDateString(),
        ])]);
    }

    public function pay(PayPenaltyRequest $request, Penalty $penalty, LoanService $loans): JsonResponse
    {
        $this->authorizeAny('penalties.manage');
        $this->assertBranchAccessible((int) $penalty->branch_id);

        $amount = (float) $request->input('penart_paid');
        $remaining = round((float) $penalty->amount - (float) $penalty->paid_amount, 2);

        if ($penalty->is_waived || $remaining <= 0) {
            throw ValidationException::withMessages(['penart_paid' => 'Penarty is already cleared']);
        }
        if ($amount > $remaining + 0.001) {
            throw ValidationException::withMessages(['penart_paid' => 'Amount is greater than penarty amount ('.money($remaining).')']);
        }

        $loans->payPenalty($penalty, $amount, CarbonImmutable::today());

        return $this->message('Penarty Paid successfully');
    }

    /**
     * Live "aporojize_penalty" (trash icon): the penalty is forgiven, recorded in the audit trail.
     */
    public function waive(Penalty $penalty): JsonResponse
    {
        $this->authorizeAny('penalties.manage');
        $this->assertBranchAccessible((int) $penalty->branch_id);

        $before = $penalty->only(['is_waived', 'amount', 'paid_amount']);
        $penalty->update(['is_waived' => true]);

        AuditLog::create([
            'company_id' => $penalty->company_id,
            'employee_id' => $this->currentEmployee()->id,
            'action' => 'Penalty.waived',
            'auditable_type' => $penalty->getMorphClass(),
            'auditable_id' => $penalty->id,
            'before' => $before,
            'after' => ['is_waived' => true],
            'ip_address' => request()->ip(),
        ]);

        return $this->message('Penalty Removed successfully');
    }

    public function paid(Request $request): JsonResponse
    {
        $this->authorizeAny('penalties.manage');
        $this->normaliseBranchFilter($request);

        $query = PenaltyPayment::query()
            ->whereHas('penalty', function ($penalty) use ($request): void {
                $this->scoped($penalty);
                $this->applyFilters($penalty, $request);
            })
            ->with(['penalty.customer', 'penalty.branch'])
            ->latest('paid_on')
            ->latest('id')
            ->when($request->filled('from'), fn ($payments) => $payments->whereDate('paid_on', '>=', $request->date('from')->toDateString()))
            ->when($request->filled('to'), fn ($payments) => $payments->whereDate('paid_on', '<=', $request->date('to')->toDateString()));

        return response()->json(['data' => $query->get()->map(fn (PenaltyPayment $payment): array => [
            'id' => $payment->id,
            'penalty_id' => $payment->penalty_id,
            'customer' => $payment->penalty?->customer?->full_name,
            'branch' => $payment->penalty?->branch?->name,
            'amount' => (float) $payment->amount,
            'paid_on' => $payment->paid_on->toDateString(),
        ])]);
    }

    /**
     * The live filter modal posts "blanch_id"; the shared filter helper reads "branch_id".
     */
    private function normaliseBranchFilter(Request $request): void
    {
        if ($request->filled('blanch_id') && ! $request->filled('branch_id')) {
            $request->merge(['branch_id' => $request->input('blanch_id')]);
        }
        if ($request->filled('branch_id') && $request->input('branch_id') !== 'all') {
            $this->assertBranchAccessible($request->integer('branch_id'));
        }
    }
}
