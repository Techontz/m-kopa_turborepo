<?php

namespace App\Http\Controllers\Api\V1\Loans;

use App\Http\Requests\Api\Loans\CollateralRequest;
use App\Http\Requests\Customers\GuarantorRequest;
use App\Models\Collateral;
use App\Models\Guarantor;
use App\Models\Loan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Guarantors & collateral of a loan application (live loan_sponser step).
 * Inferred: they can only change while the application is still editable (pending / returned).
 */
class LoanSecurityController extends LoanApiController
{
    public function storeGuarantor(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeEditable($loan);

        if ($request->filled('guarantor_id')) {
            $validated = $request->validate([
                'guarantor_id' => ['required', Rule::exists('guarantors', 'id')->where('customer_id', $loan->customer_id)],
            ]);
            Guarantor::whereKey($validated['guarantor_id'])->update(['loan_id' => $loan->id]);

            return $this->message('Guarantor added successfully');
        }

        $data = $request->validate((new GuarantorRequest)->rules());
        $loan->customer->guarantors()->create($data + ['loan_id' => $loan->id]);

        return $this->message('Guarantor Registered successfully', 201);
    }

    public function destroyGuarantor(Loan $loan, Guarantor $guarantor): JsonResponse
    {
        $this->authorizeEditable($loan);
        abort_unless((int) $guarantor->loan_id === $loan->id, 404);

        $guarantor->update(['loan_id' => null]);

        return $this->message('Guarantor Removed successfully');
    }

    public function storeCollateral(CollateralRequest $request, Loan $loan): JsonResponse
    {
        $this->authorizeEditable($loan);

        $loan->collaterals()->create([
            'name' => $request->string('colateral_name')->toString(),
            'type' => $request->string('colateral_type')->toString(),
            'location' => $request->string('colateral_location')->toString(),
            'value' => (float) $request->input('colateral_value'),
        ]);

        if ($request->hasFile('attachment')) {
            $loan->update(['collateral_attachment' => $request->file('attachment')->store('loans/collateral', 'public')]);
        }

        return $this->message('Collateral Registered successfully', 201);
    }

    public function destroyCollateral(Loan $loan, Collateral $collateral): JsonResponse
    {
        $this->authorizeEditable($loan);
        abort_unless((int) $collateral->loan_id === $loan->id, 404);

        $collateral->delete();

        return $this->message('Collateral Removed successfully');
    }

    /**
     * Live modify_colateral_attachment.
     */
    public function updateAttachment(Request $request, Loan $loan): JsonResponse
    {
        $this->authorizeEditable($loan);
        $request->validate(['attachment' => ['required', 'file', 'mimes:pdf', 'max:10240']], ['attachment.mimes' => 'PDF file is Allowed please change Your file']);

        $loan->update(['collateral_attachment' => $request->file('attachment')->store('loans/collateral', 'public')]);

        return $this->message('Attachment Updated successfully');
    }

    private function authorizeEditable(Loan $loan): void
    {
        $this->authorizeAny('loans.apply');
        $this->ensureVisible($loan);

        if (! $loan->status->isEditable()) {
            throw ValidationException::withMessages(['loan' => 'This action is not allowed while the loan is '.$loan->status->label()]);
        }
    }
}
