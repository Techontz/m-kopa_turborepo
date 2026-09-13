<?php

namespace App\Http\Controllers\Customers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\AdditionalDetailRequest;
use App\Http\Requests\Customers\BasicInformationRequest;
use App\Models\Customer;
use App\Models\Region;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\View\View;

/**
 * Three-step customer registration wizard:
 * Basic information → Aditinal Detail → Passport size & Bank Detail.
 */
class RegistrationController extends Controller
{
    public function create(): View
    {
        return view('customers.register-basic', $this->basicFormData() + ['customer' => null]);
    }

    public function store(BasicInformationRequest $request): RedirectResponse
    {
        $customer = Customer::create($request->customerData() + [
            'company_id' => $this->currentEmployee()->company_id,
            'status' => 'pending',
            'registration_step' => Customer::STEP_ADDITIONAL,
        ]);

        return redirect()->route('customers.additional', $customer);
    }

    public function editBasic(Customer $customer): View
    {
        return view('customers.register-basic', $this->basicFormData() + ['customer' => $customer]);
    }

    public function updateBasic(BasicInformationRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->customerData());

        return redirect()->route('customers.additional', $customer);
    }

    public function additional(Customer $customer): View
    {
        return view('customers.register-additional', ['customer' => $customer]);
    }

    public function storeAdditional(AdditionalDetailRequest $request, Customer $customer): RedirectResponse
    {
        $customer->update($request->customerData() + [
            'registration_step' => max($customer->registration_step, Customer::STEP_PASSPORT),
        ]);

        return redirect()->route('customers.passport', $customer);
    }

    public function passport(Customer $customer): View
    {
        return view('customers.register-passport', ['customer' => $customer]);
    }

    /**
     * Receives the cropped 160x160 passport photo as a base64 data URL.
     */
    public function uploadPhoto(Request $request, Customer $customer): JsonResponse
    {
        $request->validate(['image' => ['required', 'string', 'starts_with:data:image/']]);

        [, $encoded] = explode(',', $request->string('image')->toString(), 2);
        $binary = base64_decode($encoded, true);
        abort_if($binary === false || @getimagesizefromstring($binary) === false, 422, 'Invalid image');

        $path = 'customers/photos/'.$customer->id.'-'.Str::random(8).'.png';
        Storage::disk('public')->put($path, $binary);

        if ($customer->passport_photo) {
            Storage::disk('public')->delete($customer->passport_photo);
        }
        $customer->update(['passport_photo' => $path]);

        return response()->json(['url' => asset('storage/'.$path)]);
    }

    public function storeDocuments(Request $request, Customer $customer): RedirectResponse
    {
        $validated = $request->validate([
            'natinal_identity' => ['nullable', 'string', 'max:50'],
            'signature' => [$customer->id_attachment ? 'nullable' : 'required', 'file', 'mimes:pdf', 'max:10240'],
        ], [
            'signature.mimes' => 'PDF file is Allowed please change Your file',
        ]);

        $path = $request->hasFile('signature')
            ? $request->file('signature')->store('customers/documents', 'public')
            : $customer->id_attachment;

        $customer->update([
            'id_number' => $validated['natinal_identity'] ?? $customer->id_number,
            'id_attachment' => $path,
            'registration_step' => Customer::STEP_COMPLETE,
        ]);

        return redirect()->route('loans.form', $customer)->with('success', 'Customer Registered successfully');
    }

    /**
     * @return array<string, mixed>
     */
    private function basicFormData(): array
    {
        return [
            'branches' => $this->companyBranches(),
            'regions' => Region::orderBy('id')->get(),
        ];
    }
}
