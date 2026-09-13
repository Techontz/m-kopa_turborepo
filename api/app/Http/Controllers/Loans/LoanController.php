<?php

namespace App\Http\Controllers\Loans;

use App\Enums\Duration;
use App\Enums\LoanStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Loans\LoanApplicationRequest;
use App\Models\Group;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Services\LoanService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class LoanController extends Controller
{
    public function pending(): View
    {
        return view('loans.pending', [
            'loans' => $this->loans()->status(LoanStatus::PendingManagerApproval)->where('is_special', false)->latest('id')->get(),
            'specialCount' => $this->loans()->status(LoanStatus::PendingManagerApproval)->where('is_special', true)->count(),
            'special' => false,
        ]);
    }

    public function special(): View
    {
        return view('loans.pending', [
            'loans' => $this->loans()->status(LoanStatus::PendingManagerApproval)->where('is_special', true)->latest('id')->get(),
            'specialCount' => 0,
            'special' => true,
        ]);
    }

    public function show(Loan $loan, LoanService $loans): View
    {
        $loan->load(['customer.region', 'customer.loans.category', 'branch', 'category', 'guarantors', 'collaterals']);

        return view('loans.show', [
            'loan' => $loan,
            'deductions' => $loans->deductions($loan),
        ]);
    }

    public function edit(Loan $loan): View
    {
        $loan->load(['customer', 'category', 'guarantors.region', 'collaterals']);

        return view('loans.edit', [
            'loan' => $loan,
            'categories' => LoanCategory::where('company_id', $loan->company_id)->orderBy('id')->get(),
            'groups' => Group::where('company_id', $loan->company_id)->get(),
        ]);
    }

    public function update(LoanApplicationRequest $request, Loan $loan, LoanService $loans): RedirectResponse
    {
        abort_unless($loan->status === LoanStatus::PendingManagerApproval, 403);

        $data = $request->loanData();
        $category = LoanCategory::findOrFail($data['loan_category_id']);
        $loan->fill([
            'loan_category_id' => $category->id,
            'group_id' => $data['group_id'],
            'amount_applied' => $data['amount_applied'],
            'duration' => $category->duration,
            'sessions' => $data['sessions'],
            'instalment' => $request->input('instalment', 0) ?: 0,
            'formula' => $data['formula'],
            'fee_deduct' => $data['fee_deduct'],
            'reason' => $data['reason'],
            'interest_rate' => $category->interest_rate,
        ]);
        $loan->setRelation('category', $category);
        $loans->price($loan, $data['amount_applied']);
        $loan->save();

        return redirect()->route('loans.pending')->with('success', 'Loan Updated successfully');
    }

    public function updateCollateralAttachment(Request $request, Loan $loan): RedirectResponse
    {
        $request->validate(['attachment' => ['required', 'file', 'mimes:pdf', 'max:10240']], ['attachment.mimes' => 'PDF file is Allowed please change Your file']);
        $loan->update(['collateral_attachment' => $request->file('attachment')->store('loans/collateral', 'public')]);

        return back()->with('success', 'Attachment Updated successfully');
    }

    public function approve(Request $request, Loan $loan, LoanService $loans): RedirectResponse
    {
        abort_unless($loan->status === LoanStatus::PendingManagerApproval, 403);
        $validated = $request->validate(['loan_aprove' => ['required', 'numeric', 'min:1', 'lte:'.(float) $loan->category->amount_to]]);

        try {
            $loans->approve($loan, (float) $validated['loan_aprove']);
        } catch (ValidationException $exception) {
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return redirect()->route('loans.disbursed')->with('success', 'Loan Aproved successfully');
    }

    public function reject(Loan $loan, LoanService $loans): RedirectResponse
    {
        abort_unless($loan->status === LoanStatus::PendingManagerApproval, 403);
        $loans->reject($loan);

        return redirect()->route('loans.pending')->with('success', 'Loan Rejected successfully');
    }

    public function destroy(Loan $loan): RedirectResponse
    {
        if (! in_array($loan->status, [LoanStatus::PendingManagerApproval, LoanStatus::AwaitingDisbursement, LoanStatus::Rejected], true)) {
            return back()->with('error', 'Only loans that have not been withdrawn can be deleted');
        }

        $loan->guarantors()->update(['loan_id' => null]);
        $loan->delete();

        return back()->with('success', 'Loan Deleted successfully');
    }

    public function disbursed(): View
    {
        return view('loans.disbursed', [
            'loans' => $this->loans()->status(LoanStatus::AwaitingDisbursement, LoanStatus::Active)->with('schedules')->latest('approved_at')->get(),
        ]);
    }

    public function uploadAgreement(Request $request, Loan $loan): RedirectResponse
    {
        $request->validate(['attach' => ['required', 'file', 'mimes:pdf', 'max:10240']], ['attach.mimes' => 'PDF file is Allowed please change Your file']);
        $loan->update(['agreement_file' => $request->file('attach')->store('loans/agreements', 'public')]);

        return back()->with('success', 'Loan Agrement uploaded successfully');
    }

    public function agreement(Loan $loan): View
    {
        $loan->load(['customer.region', 'branch', 'category', 'guarantors', 'collaterals', 'company']);

        return view('loans.agreement', ['loan' => $loan]);
    }

    public function withdrawals(Request $request): View
    {
        $query = $this->loans()
            ->whereNotNull('withdrawn_at')
            ->when($request->filled('blanch_id') && $request->input('blanch_id') !== 'all', fn (Builder $builder) => $builder->where('branch_id', $request->integer('blanch_id')))
            ->when($request->filled('loan_status') && $request->input('loan_status') !== 'all', fn (Builder $builder) => $builder->where('status', $request->string('loan_status')))
            ->when($request->filled('from'), fn (Builder $builder) => $builder->whereDate('withdrawn_at', '>=', $request->date('from')))
            ->when($request->filled('to'), fn (Builder $builder) => $builder->whereDate('withdrawn_at', '<=', $request->date('to')))
            ->when(! $request->hasAny(['from', 'to']), fn (Builder $builder) => $builder->whereDate('withdrawn_at', now()->toDateString()));

        $loans = $query->latest('withdrawn_at')->get();

        return view('loans.withdrawals', [
            'groups' => collect(['All' => $loans])->merge(
                collect([Duration::Monthly, Duration::Weekly, Duration::Daily])
                    ->mapWithKeys(fn (Duration $duration): array => [$duration->label() => $loans->where('duration', $duration)])
            ),
            'branches' => $this->companyBranches(),
        ]);
    }

    public function rejected(): View
    {
        return view('loans.rejected', ['loans' => $this->loans()->status(LoanStatus::Rejected)->latest('id')->get()]);
    }

    public function writeOff(Loan $loan, LoanService $loans): RedirectResponse
    {
        abort_unless(in_array($loan->status, [LoanStatus::Default, LoanStatus::Overdue, LoanStatus::Active], true), 403);
        $loans->writeOff($loan, $this->currentEmployee());

        return back()->with('success', 'Loan moved to Wright-off successfully');
    }

    /**
     * @return Builder<Loan>
     */
    private function loans(): Builder
    {
        return Loan::where('company_id', $this->currentEmployee()->company_id)->with(['customer', 'branch', 'category']);
    }
}
