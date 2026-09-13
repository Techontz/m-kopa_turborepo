<?php

namespace App\Http\Controllers\Customers;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\GuarantorRequest;
use App\Models\Customer;
use App\Models\Guarantor;
use Illuminate\Http\RedirectResponse;

class GuarantorController extends Controller
{
    public function store(GuarantorRequest $request, Customer $customer): RedirectResponse
    {
        $customer->guarantors()->create($request->validated());

        return back()->with('success', 'Guarantor Registered successfully');
    }

    public function update(GuarantorRequest $request, Guarantor $guarantor): RedirectResponse
    {
        $guarantor->update($request->validated());

        return back()->with('success', 'Guarantor Updated successfully');
    }

    public function destroy(Guarantor $guarantor): RedirectResponse
    {
        $guarantor->delete();

        return back()->with('success', 'Guarantor Removed successfully');
    }
}
