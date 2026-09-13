<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\CompanyRequest;
use App\Models\Region;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class CompanyController extends Controller
{
    public function edit(): View
    {
        return view('settings.company', [
            'company' => $this->company(),
            'regions' => Region::orderBy('id')->get(),
        ]);
    }

    public function update(CompanyRequest $request): RedirectResponse
    {
        $this->company()->update($request->companyData());

        return back()->with('success', 'Company Profile Updated successfully');
    }

    public function password(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'oldpass' => ['required', 'string'],
            'newpass' => ['required', 'string', 'min:4'],
            'passconf' => ['required', 'same:newpass'],
        ], [
            'passconf.same' => 'New Password and Confirm Password do not match',
        ]);

        $employee = $this->employee();

        if (! Hash::check($validated['oldpass'], $employee->password)) {
            return back()->with('error', 'Old Password is incorrect');
        }

        $employee->update(['password' => $validated['newpass']]);

        return back()->with('success', 'Password Changed successfully');
    }

    public function logo(Request $request): RedirectResponse
    {
        $request->validate([
            'comp_logo' => ['required', 'image', 'max:2048'],
        ]);

        $company = $this->company();
        $previousLogo = $company->logo;

        $company->update(['logo' => $request->file('comp_logo')->store('logos', 'public')]);

        if ($previousLogo !== null) {
            Storage::disk('public')->delete($previousLogo);
        }

        return back()->with('success', 'Company Logo Updated successfully');
    }
}
