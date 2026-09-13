<?php

namespace App\Http\Controllers\Customers;

use App\Enums\Duration;
use App\Enums\LoanStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\AdditionalDetailRequest;
use App\Http\Requests\Customers\BasicInformationRequest;
use App\Models\Customer;
use App\Models\Region;
use App\Models\SmsLog;
use App\Services\LoanService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class CustomerController extends Controller
{
    public function index(Request $request): View
    {
        $customers = Customer::where('company_id', $this->currentEmployee()->company_id)
            ->with('branch')
            ->when($request->filled('blanch_id') && $request->input('blanch_id') !== 'all', fn ($query) => $query->where('branch_id', $request->integer('blanch_id')))
            ->when($request->filled('customer_status'), fn ($query) => $query->where('status', $request->string('customer_status')))
            ->latest('id')
            ->get();

        return view('customers.index', ['customers' => $customers, 'branches' => $this->companyBranches()]);
    }

    public function search(): View
    {
        return view('customers.search', [
            'customers' => Customer::where('company_id', $this->currentEmployee()->company_id)->latest('id')->get(),
        ]);
    }

    public function show(Customer $customer, LoanService $loans): View
    {
        $customer->load(['branch', 'employee', 'region', 'guarantors.region', 'loans.category']);
        $latestLoan = $customer->loans->sortByDesc('id')->first();

        return view('customers.show', [
            'customer' => $customer,
            'branches' => $this->companyBranches(),
            'regions' => Region::orderBy('id')->get(),
            'balance' => $latestLoan ? $loans->deductions($latestLoan) : null,
        ]);
    }

    public function updateBasic(BasicInformationRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->customerData());

        return back()->with('success', 'Customer information updated successfully');
    }

    public function updateAdditional(AdditionalDetailRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->customerData());

        return back()->with('success', 'Customer information updated successfully');
    }

    public function updateDocuments(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'natinal_identity' => ['nullable', 'string', 'max:50'],
            'signature' => ['required', 'file', 'mimes:pdf', 'max:10240'],
        ], [
            'signature.mimes' => 'PDF file is Allowed please change Your file',
        ]);

        $customer->update([
            'id_number' => $validated['natinal_identity'] ?? $customer->id_number,
            'id_attachment' => $request->file('signature')->store('customers/documents', 'public'),
        ]);

        return back()->with('success', 'Document uploaded successfully');
    }

    public function approveKyc(Customer $customer): RedirectResponse
    {
        $customer->update(['kyc_status' => 'approved']);

        return back()->with('success', 'Customer KYC Aproved successfully');
    }

    public function mark(Customer $customer): RedirectResponse
    {
        $customer->update(['is_marked' => ! $customer->is_marked]);

        return back()->with('success', $customer->is_marked ? 'Customer Marked successfully' : 'Customer Unmarked successfully');
    }

    /**
     * The live system sends an SMS through a provider that could not be observed;
     * messages are recorded in sms_logs so a gateway can be plugged in later.
     */
    public function sendSms(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate(['message' => ['required', 'string', 'max:480']]);

        SmsLog::create([
            'company_id' => $customer->company_id,
            'customer_id' => $customer->id,
            'phone' => $customer->phone,
            'message' => $validated['message'],
        ]);

        return back()->with('success', 'Message sent successfully');
    }

    public function destroy(Customer $customer): RedirectResponse
    {
        if ($customer->loans()->whereNotIn('status', [LoanStatus::Rejected->value])->exists()) {
            return back()->with('error', 'Customer has loans and cannot be deleted');
        }

        $customer->delete();

        return redirect()->route('customers.index')->with('success', 'Customer Deleted successfully');
    }

    public function byDuration(Request $request, string $duration): View
    {
        $durationCase = Duration::from($duration);

        $customers = Customer::where('company_id', $this->currentEmployee()->company_id)
            ->whereHas('loans', fn ($query) => $query->where('duration', $durationCase->value)->whereNotIn('status', [LoanStatus::PendingManagerApproval->value, LoanStatus::Rejected->value]))
            ->when($request->filled('customer_status'), fn ($query) => $query->where('status', $request->string('customer_status')))
            ->latest('id')
            ->get();

        return view('customers.by-duration', ['customers' => $customers, 'duration' => $durationCase]);
    }
}
