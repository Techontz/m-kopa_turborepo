<?php

namespace App\Http\Controllers\Loans;

use App\Enums\LoanStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\GuarantorRequest;
use App\Http\Requests\Loans\LoanApplicationRequest;
use App\Models\Collateral;
use App\Models\Customer;
use App\Models\Group;
use App\Models\Guarantor;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\Region;
use App\Services\LoanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class LoanApplicationController extends Controller
{
    public function index(): View
    {
        return view('customers.search', [
            'customers' => Customer::where('company_id', $this->currentEmployee()->company_id)->latest('id')->get(),
            'targetRoute' => 'loans.start',
            'showCode' => true,
            'placeholder' => 'Sarch Customer',
            'breadcrumbs' => ['Loan', 'Loan Aplication'],
        ]);
    }

    /**
     * Live "edit_viewSponser": resumes an incomplete registration at its next step,
     * otherwise walks the officer through confirming the customer's details first.
     */
    public function start(Customer $customer): RedirectResponse
    {
        return redirect($customer->nextRegistrationUrl() ?? route('customers.basic', $customer));
    }

    public function form(Customer $customer): View|RedirectResponse
    {
        if ($customer->nextRegistrationUrl() !== null) {
            return redirect($customer->nextRegistrationUrl());
        }

        return view('loans.application-form', [
            'customer' => $customer,
            'categories' => LoanCategory::where('company_id', $customer->company_id)
                ->whereHas('branches', fn ($query) => $query->whereKey($customer->branch_id))
                ->orderBy('id')
                ->get(),
            'groups' => Group::where('company_id', $customer->company_id)->orderBy('name')->get(),
        ]);
    }

    public function store(LoanApplicationRequest $request, Customer $customer, LoanService $loans): RedirectResponse
    {
        $hasOpenApplication = $customer->loans()->status(LoanStatus::Pending, LoanStatus::Disbursed)->exists();
        if ($hasOpenApplication) {
            return back()->withInput()->with('error', 'Customer already has a loan waiting for approval or withdrawal');
        }

        $loan = $loans->apply($customer, $request->loanData(), $this->currentEmployee());

        return redirect()->route('loans.securities', $loan);
    }

    /**
     * Guarantors & collateral step. Not reachable on the live system without creating a loan,
     * so this page is built from the guarantor/collateral data shown on the approval screens.
     */
    public function securities(Loan $loan): View
    {
        $loan->load(['customer.guarantors', 'guarantors', 'collaterals', 'category']);

        return view('loans.securities', ['loan' => $loan, 'regions' => Region::orderBy('id')->get()]);
    }

    public function storeGuarantor(Request $request, Loan $loan): RedirectResponse
    {
        if ($request->filled('guarantor_id')) {
            $validated = $request->validate([
                'guarantor_id' => ['required', Rule::exists('guarantors', 'id')->where('customer_id', $loan->customer_id)],
            ]);
            Guarantor::whereKey($validated['guarantor_id'])->update(['loan_id' => $loan->id]);

            return back()->with('success', 'Guarantor added successfully');
        }

        $data = app(GuarantorRequest::class)->validated();
        $loan->customer->guarantors()->create($data + ['loan_id' => $loan->id]);

        return back()->with('success', 'Guarantor Registered successfully');
    }

    public function storeCollateral(Request $request, Loan $loan): RedirectResponse
    {
        $validated = $request->validate([
            'colateral_name' => ['required', 'string', 'max:100'],
            'colateral_type' => ['required', 'string', 'max:100'],
            'colateral_location' => ['required', 'string', 'max:100'],
            'colateral_value' => ['required', 'numeric', 'min:0'],
            'attachment' => ['nullable', 'file', 'mimes:pdf', 'max:10240'],
        ], ['attachment.mimes' => 'PDF file is Allowed please change Your file']);

        $loan->collaterals()->create([
            'name' => $validated['colateral_name'],
            'type' => $validated['colateral_type'],
            'location' => $validated['colateral_location'],
            'value' => $validated['colateral_value'],
        ]);

        if ($request->hasFile('attachment')) {
            $loan->update(['collateral_attachment' => $request->file('attachment')->store('loans/collateral', 'public')]);
        }

        return back()->with('success', 'Collateral Registered successfully');
    }

    public function destroyCollateral(Collateral $collateral): RedirectResponse
    {
        $collateral->delete();

        return back()->with('success', 'Collateral Removed successfully');
    }
}
