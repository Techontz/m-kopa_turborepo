<?php

namespace App\Http\Controllers\Api\V1\Payments;

use App\Enums\LoanStatus;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Api\Payments\AllocateSuspenseRequest;
use App\Http\Requests\Api\Payments\ReasonRequest;
use App\Http\Requests\Api\Payments\UnmatchedPaymentRequest;
use App\Http\Resources\Api\V1\Payments\PaymentResource;
use App\Models\Loan;
use App\Models\Payment;
use App\Services\AccessControl;
use App\Services\LoanService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Payments → Suspense Account: unmatched and overpaid money. Finance views it, searches the customer,
 * confirms ownership and allocates (Documents: POST /payments/allocate), flags or refunds it.
 */
class SuspenseController extends ApiController
{
    public function __construct(
        private readonly PaymentService $payments,
        private readonly LoanService $loans,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizeAny('payments.suspense');

        $status = $request->input('status', 'suspense');
        $query = $this->scoped(Payment::query())
            ->when($status === 'suspense', fn ($query) => $query->whereIn('status', PaymentStatus::values(...PaymentStatus::suspense())))
            ->when($status === 'direct', fn ($query) => $query->where('source', Payment::SOURCE_WEBHOOK))
            ->when(! in_array($status, ['suspense', 'direct', 'all'], true), fn ($query) => $query->where('status', $status))
            ->when($status === 'all', fn ($query) => $query->where(fn ($inner) => $inner->where('source', '!=', Payment::SOURCE_TELLER)->orWhereNotNull('parent_id')))
            ->with(['customer', 'branch', 'employee', 'loan', 'parent', 'verifier', 'allocations.loan', 'allocations.loanTransaction'])
            ->latest('paid_on')
            ->latest('id');
        $this->applyFilters($query, $request, 'paid_on');

        $rows = $query->get();

        return response()->json([
            'data' => PaymentResource::collection($rows),
            'suspense_balance' => round((float) $this->scoped(Payment::query())->whereIn('status', PaymentStatus::values(...PaymentStatus::suspense()))->get()->sum('unallocated_amount'), 2),
        ]);
    }

    public function store(UnmatchedPaymentRequest $request): JsonResponse
    {
        $this->authorizeAny('payments.suspense');
        if ($request->filled('branch_id')) {
            $this->assertBranchAccessible($request->integer('branch_id'));
        }

        $payment = $this->payments->recordUnmatched($this->currentEmployee()->company_id, $request->validated(), $this->currentEmployee());

        return $this->message('Payment saved to suspense successfully', 201, ['data' => new PaymentResource($payment)]);
    }

    public function allocate(AllocateSuspenseRequest $request, Payment $payment): JsonResponse
    {
        $this->authorizeAny('payments.suspense');
        $this->assertPaymentAccessible($payment);
        $loan = Loan::findOrFail($request->integer('loan_id'));
        $this->assertBranchAccessible((int) $loan->branch_id);

        $this->payments->allocateSuspense($payment, $loan, (float) $request->input('amount'), $this->currentEmployee());

        return $this->message('Payment allocated successfully');
    }

    public function flag(ReasonRequest $request, Payment $payment): JsonResponse
    {
        $this->authorizeAny('payments.suspense');
        $this->assertPaymentAccessible($payment);

        $payment = $this->payments->flag($payment, $request->string('reason')->toString());

        return $this->message($payment->status === PaymentStatus::Flagged ? 'Payment flagged successfully' : 'Flag removed successfully');
    }

    public function refund(ReasonRequest $request, Payment $payment): JsonResponse
    {
        $this->authorizeAny('payments.suspense');
        $this->assertPaymentAccessible($payment);

        $this->payments->refund($payment, $request->string('reason')->toString(), $this->currentEmployee());

        return $this->message('Payment refunded successfully');
    }

    /**
     * Repayable loans as {value,label} with outstanding balance, for the allocation modal.
     */
    public function loanOptions(Request $request): JsonResponse
    {
        $this->authorizeAny('payments.suspense');

        $loans = $this->scoped(Loan::query())
            ->whereIn('status', LoanStatus::values(...LoanStatus::repayable()))
            ->when($request->filled('customer_id'), fn ($query) => $query->where('customer_id', $request->integer('customer_id')))
            ->with('customer')
            ->latest('id')
            ->limit(500)
            ->get();

        return response()->json(['data' => $loans->map(function (Loan $loan): array {
            $outstanding = $this->loans->outstanding($loan);

            return [
                'value' => (string) $loan->id,
                'label' => $loan->customer->full_name.' / '.($loan->reference_number ?? $loan->loan_number).' — '.money($outstanding['total']),
                'customer_id' => $loan->customer_id,
                'phone' => $loan->customer->phone,
                'outstanding' => $outstanding,
            ];
        })]);
    }

    private function assertPaymentAccessible(Payment $payment): void
    {
        if ($payment->branch_id === null) {
            abort_unless(app(AccessControl::class)->branchIds($this->currentEmployee()) === null, 403, 'You do not have access to this branch.');

            return;
        }

        $this->assertBranchAccessible((int) $payment->branch_id);
    }
}
