<?php

namespace App\Http\Controllers\Api\V1\Loans;

use App\Enums\LoanStatus;
use App\Http\Requests\Api\Loans\DisbursementSourceRequest;
use App\Http\Requests\Api\Loans\EscalationRequest;
use App\Http\Requests\Api\Loans\LoanReasonRequest;
use App\Http\Requests\Api\Loans\MandateRequest;
use App\Http\Resources\Api\V1\Loans\LoanResource;
use App\Models\Loan;
use App\Services\LoanService;
use App\Services\LoanWorkflow;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Loan lifecycle actions (Documents: LOAN PROCESS OVERVIEW): manager approval, e-mandate + OTP, credit officer
 * review with Vodacom KYC, finance preparation, Vodacom disbursement with retries and escalation, closure,
 * write-off, comments and loan agreement upload.
 */
class LoanWorkflowController extends LoanApiController
{
    public function __construct(private readonly LoanWorkflow $workflow) {}

    /**
     * POST /loans/{id}/approve-manager with the live "Approved Loan" field (loan_aprove).
     */
    public function approveManager(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.approve_manager');
        $this->ensureVisible($loan);
        $validated = $request->validate(['loan_aprove' => ['required', 'numeric', 'min:1']]);

        $loan = $this->workflow->approveByManager($loan, (float) $validated['loan_aprove'], $this->currentEmployee());

        return $this->loanMessage('Loan Approved successfully', $loan);
    }

    /**
     * Reject with reason — branch manager at approval, credit officer at credit review.
     */
    public function reject(LoanReasonRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeStage($loan);
        $loan = $this->workflow->reject($loan, $request->string('reason')->toString(), $this->currentEmployee());

        return $this->loanMessage('Loan Rejected successfully', $loan);
    }

    /**
     * Modify → back to the loan officer with a reason.
     */
    public function modify(LoanReasonRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeStage($loan);
        $loan = $this->workflow->returnForModification($loan, $request->string('reason')->toString(), $this->currentEmployee());

        return $this->loanMessage('Loan returned to loan officer for modification', $loan);
    }

    public function createMandate(MandateRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.apply', 'loans.approve_manager');
        $this->ensureVisible($loan);

        $result = $this->workflow->createMandate($loan, $request->validated(), $this->currentEmployee());

        return $this->loanMessage($result['message'], $loan->fresh(), $result['success'] ? 200 : 422);
    }

    public function verifyMandateOtp(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.apply', 'loans.approve_manager');
        $this->ensureVisible($loan);
        $validated = $request->validate(['otp' => ['required', 'digits:6']]);

        $result = $this->workflow->verifyMandateOtp($loan, $validated['otp'], $this->currentEmployee());

        return $this->loanMessage($result['message'], $loan->fresh(), $result['success'] ? 200 : 422);
    }

    /**
     * POST /vodacom/kyc-verify for the loan's customer.
     */
    public function verifyTelco(Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.credit_review');
        $this->ensureVisible($loan);

        $result = $this->workflow->verifyTelco($loan, $this->currentEmployee());

        return $this->loanMessage($result['message'], $loan->fresh(), 200, ['verification' => $result]);
    }

    public function approveCredit(Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.credit_review');
        $this->ensureVisible($loan);

        $loan = $this->workflow->approveCredit($loan, $this->currentEmployee());

        return $this->loanMessage('Loan Approved successfully. Reference number: '.$loan->reference_number, $loan);
    }

    /**
     * Finance prepares the batch and chooses the disbursement source (branch cash or a company bank account).
     */
    public function prepareDisbursement(DisbursementSourceRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.prepare_disbursement');
        $this->ensureVisible($loan);

        $disbursement = $this->workflow->prepareDisbursement($loan, $this->currentEmployee(), $request->source());

        return $this->loanMessage('Disbursement prepared, batch '.$disbursement->batch_id.' from '.$disbursement->sourceLabel(), $loan->fresh());
    }

    /**
     * Accounts the loan can be disbursed from, with balances and the amount required from each.
     */
    public function disbursementSources(Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.prepare_disbursement', 'loans.disburse');
        $this->ensureVisible($loan);

        return response()->json(['data' => $this->workflow->sourceOptions($loan)]);
    }

    /**
     * Finance "Disburse" → request to Vodacom; the page opens the Vodacom portal when configured.
     */
    public function disburse(DisbursementSourceRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.disburse');
        $this->ensureVisible($loan);

        $result = $this->workflow->requestDisbursement($loan, $this->currentEmployee(), $request->source());

        return $this->loanMessage($result['message'], $loan->fresh(), $result['status'] === LoanStatus::Active || $result['status'] === LoanStatus::AwaitingDisbursement ? 200 : 422, [
            'batch_id' => $result['batch_id'],
            'portal_url' => $result['portal_url'],
        ]);
    }

    public function retry(DisbursementSourceRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.disburse');
        $this->ensureVisible($loan);

        $result = $this->workflow->retryDisbursement($loan, $this->currentEmployee(), $request->source());

        return $this->loanMessage($result['message'], $loan->fresh(), $result['status'] === LoanStatus::Active || $result['status'] === LoanStatus::AwaitingDisbursement ? 200 : 422, [
            'batch_id' => $result['batch_id'],
            'portal_url' => $result['portal_url'],
        ]);
    }

    public function escalation(EscalationRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.disburse');
        $this->ensureVisible($loan);

        $loan = $this->workflow->resolveEscalation($loan, $request->string('action')->toString(), $request->input('channel'), $request->string('reason')->toString(), $this->currentEmployee(), $request->source());

        return $this->loanMessage(match ($loan->status) {
            LoanStatus::Cancelled => 'Loan Cancelled successfully',
            LoanStatus::DisbursementSuspense => 'Loan moved to suspense successfully',
            default => 'Disbursement moved to '.strtoupper((string) $loan->disbursement_channel).' successfully',
        }, $loan);
    }

    public function requeue(Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.disburse', 'loans.prepare_disbursement');
        $this->ensureVisible($loan);

        return $this->loanMessage('Loan sent back to Finance successfully', $this->workflow->requeue($loan, $this->currentEmployee()));
    }

    public function confirmDisbursement(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.disburse');
        $this->ensureVisible($loan);
        $validated = $request->validate(['reference' => ['required', 'string', 'max:100']]);

        return $this->loanMessage('Loan Disbursed successfully', $this->workflow->confirmManualDisbursement($loan, $validated['reference'], $this->currentEmployee()));
    }

    /**
     * Branch cash-out with the SMS withdrawal code (cash channel chosen for an escalated disbursement).
     */
    public function cashOut(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('payments.cash');
        $this->ensureVisible($loan);
        $validated = $request->validate(['code' => ['required', 'digits_between:4,6']]);

        return $this->loanMessage('Withdrawal successfully', $this->workflow->cashOut($loan, (string) $validated['code'], $this->currentEmployee()));
    }

    public function close(Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.approve_manager', 'loans.disburse', 'payments.verify');
        $this->ensureVisible($loan);

        return $this->loanMessage('Loan Closed successfully', $this->workflow->close($loan, $this->currentEmployee()));
    }

    /**
     * Live wright_off_loan (Documents: "Mikopo isiyolipika → Write-Off").
     */
    public function writeOff(Loan $loan, LoanService $loans): JsonResponse
    {
        $this->authorizeAny('loans.write_off');
        $this->ensureVisible($loan);

        if (! in_array($loan->status, LoanStatus::repayable(), true)) {
            return $this->message('Only active, overdue or default loans can be written off', 422);
        }

        $from = $loan->status;
        $loans->writeOff($loan, $this->currentEmployee());
        $this->workflow->record($loan->fresh(), 'WRITTEN_OFF', $from, $this->currentEmployee());

        return $this->loanMessage('Loan moved to Write-off successfully', $loan->fresh());
    }

    /**
     * Zone manager / any viewer comment on the loan timeline (handwritten note: zone "mtu wa kuview na comment").
     */
    public function comment(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.view');
        $this->ensureVisible($loan);
        $validated = $request->validate(['comment' => ['required', 'string', 'max:1000']]);

        $this->workflow->comment($loan, $validated['comment'], $this->currentEmployee());

        return $this->message('Comment added successfully');
    }

    /**
     * Live upload_loan_agrement (PDF).
     */
    public function uploadAgreement(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeAny('loans.apply', 'loans.approve_manager', 'loans.disburse');
        $this->ensureVisible($loan);
        $request->validate(['attach' => ['required', 'file', 'mimes:pdf', 'max:10240']], ['attach.mimes' => 'PDF file is Allowed please change Your file']);

        $loan->update(['agreement_file' => $request->file('attach')->store('loans/agreements', 'public')]);

        return $this->loanMessage('Loan Agreement uploaded successfully', $loan);
    }

    /**
     * Documents: "Cron Job POST /loans/overdue/process" — also runs daily via loans:process-overdue.
     */
    public function processOverdue(LoanService $loans): JsonResponse
    {
        $this->authorizeAny('penalties.manage');

        $summary = $loans->applyPenaltiesAndDefaults(CarbonImmutable::today());

        return $this->message('Overdue loans processed successfully', 200, ['data' => $summary]);
    }

    private function authorizeStage(Loan $loan): void
    {
        $this->ensureVisible($loan);

        if ($loan->status === LoanStatus::PendingCreditReview) {
            $this->authorizeAny('loans.credit_review');
        } else {
            $this->authorizeAny('loans.approve_manager');
        }
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function loanMessage(string $message, Loan $loan, int $status = 200, array $extra = []): JsonResponse
    {
        return $this->message($message, $status, ['data' => new LoanResource($loan->loadMissing(['customer', 'branch', 'category']))] + $extra);
    }
}
