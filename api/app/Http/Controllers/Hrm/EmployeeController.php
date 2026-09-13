<?php

namespace App\Http\Controllers\Hrm;

use App\Http\Controllers\Controller;
use App\Http\Requests\Hrm\EmployeeRequest;
use App\Http\Requests\Hrm\EmployeeSalaryRequest;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeePrivilege;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class EmployeeController extends Controller
{
    public function index(): View
    {
        $employees = Employee::where('company_id', $this->currentEmployee()->company_id)
            ->where('status', '!=', 'rejected')
            ->with('branch')
            ->orderByDesc('id')
            ->get();

        return view('hrm.employees.index', [
            'employees' => $employees,
            'branches' => $this->companyBranches(),
        ]);
    }

    public function rejected(): View
    {
        $employees = Employee::where('company_id', $this->currentEmployee()->company_id)
            ->where('status', 'rejected')
            ->with('branch')
            ->orderByDesc('id')
            ->get();

        return view('hrm.employees.rejected', ['employees' => $employees]);
    }

    public function byBranch(): View
    {
        $branches = Branch::where('company_id', $this->currentEmployee()->company_id)
            ->with(['region', 'employees' => fn ($query) => $query->orderBy('id')])
            ->orderBy('id')
            ->get();

        return view('hrm.employees.by-branch', ['branches' => $branches]);
    }

    /**
     * New staff get the live default password: their phone number. The Empl/ID follows the
     * live pattern MK-<3 digit sequence><year> (e.g. MK-0022024).
     */
    public function store(EmployeeRequest $request): RedirectResponse
    {
        $companyId = $this->currentEmployee()->company_id;
        $data = $request->employeeData();
        $sequence = Employee::where('company_id', $companyId)->count() + 1;

        Employee::create($data + [
            'company_id' => $companyId,
            'employee_number' => 'MK-'.str_pad((string) $sequence, 3, '0', STR_PAD_LEFT).now()->format('Y'),
            'status' => 'active',
            'password' => $data['phone'],
        ]);

        return back()->with('success', 'Employee Registered successfully');
    }

    public function show(Employee $employee): View
    {
        $employee->load([
            'branch',
            'salaryInfo',
            'allowances' => fn ($query) => $query->latest('id'),
            'deductions' => fn ($query) => $query->latest('id'),
            'salaryAdvances' => fn ($query) => $query->latest('id'),
            'staffLoans' => fn ($query) => $query->where('status', '!=', 'pending')->withSum('payments', 'amount')->latest('id'),
            'salaryPayments' => fn ($query) => $query->latest('id'),
        ]);

        return view('hrm.employees.show', [
            'employee' => $employee,
            'branches' => $this->companyBranches(),
        ]);
    }

    public function update(EmployeeRequest $request, Employee $employee): RedirectResponse
    {
        $employee->update($request->employeeData());

        return back()->with('success', 'Employee Updated successfully');
    }

    /**
     * Receives the cropped passport photo as a base64 data URL (same flow as customer passports),
     * or a plain file upload.
     */
    public function photo(Request $request, Employee $employee): JsonResponse|RedirectResponse
    {
        if ($request->hasFile('image')) {
            $request->validate(['image' => ['required', 'image', 'max:5120']]);
            $path = $request->file('image')->store('employees/photos', 'public');
        } else {
            $request->validate(['image' => ['required', 'string', 'starts_with:data:image/']]);
            [, $encoded] = explode(',', $request->string('image')->toString(), 2) + [1 => ''];
            $binary = base64_decode($encoded, true);
            abort_if($binary === false || @getimagesizefromstring($binary) === false, 422, 'Invalid image');

            $path = 'employees/photos/'.$employee->id.'-'.Str::random(8).'.png';
            Storage::disk('public')->put($path, $binary);
        }

        if ($employee->photo) {
            Storage::disk('public')->delete($employee->photo);
        }
        $employee->update(['photo' => $path]);

        if ($request->expectsJson() || $request->ajax()) {
            return response()->json(['url' => asset('storage/'.$path)]);
        }

        return back()->with('success', 'Passport uploaded successfully');
    }

    public function salary(EmployeeSalaryRequest $request, Employee $employee): RedirectResponse
    {
        $employee->salaryInfo()->updateOrCreate(['employee_id' => $employee->id], $request->salaryData());

        return back()->with('success', 'Sallary Information Saved successfully');
    }

    public function password(Request $request, Employee $employee): RedirectResponse
    {
        $request->validate([
            'oldpass' => ['required', 'string'],
            'newpass' => ['required', 'string', 'min:4'],
            'passconf' => ['required', 'same:newpass'],
        ], [
            'passconf.same' => 'Password does not match',
        ]);

        if (! Hash::check($request->string('oldpass')->toString(), $employee->password)) {
            return back()->with('error', 'Old password is incorrect');
        }

        $employee->update(['password' => $request->string('newpass')->toString()]);

        return back()->with('success', 'Password changed successfully');
    }

    public function toggleBlock(Employee $employee): RedirectResponse
    {
        if ($this->isSignedIn($employee)) {
            return back()->with('error', 'You can not block your own account');
        }

        $blocked = $employee->status !== 'blocked';
        $employee->update(['status' => $blocked ? 'blocked' : 'active']);

        return back()->with('success', $blocked ? 'Employee Blocked successfully' : 'Employee Unblocked successfully');
    }

    public function reject(Employee $employee): RedirectResponse
    {
        if ($this->isSignedIn($employee)) {
            return back()->with('error', 'You can not reject your own account');
        }

        $employee->update(['status' => 'rejected']);

        return back()->with('success', 'Employee Rejected successfully');
    }

    /**
     * Inferred: "reset_panel" restores the default password (the phone number).
     */
    public function resetPassword(Employee $employee): RedirectResponse
    {
        if ($this->isSignedIn($employee)) {
            return back()->with('error', 'You can not reset your own password here');
        }

        $employee->update(['password' => $employee->phone]);

        return back()->with('success', 'Password reset successfully');
    }

    public function destroy(Employee $employee): RedirectResponse
    {
        if ($this->isSignedIn($employee)) {
            return back()->with('error', 'You can not delete your own account');
        }

        if ($employee->photo) {
            Storage::disk('public')->delete($employee->photo);
        }
        $employee->delete();

        return back()->with('success', 'Employee Deleted successfully');
    }

    public function privileges(Employee $employee): View
    {
        return view('hrm.employees.privileges', [
            'employee' => $employee,
            'assigned' => $employee->privileges()->orderBy('id')->get(),
        ]);
    }

    public function addPrivilege(Request $request, Employee $employee): RedirectResponse
    {
        $validated = $request->validate(['privilege' => ['required', Rule::in(array_keys(Employee::PRIVILEGES))]]);

        $employee->privileges()->firstOrCreate(['privilege' => $validated['privilege']]);

        return back()->with('success', 'Privillage Added successfully');
    }

    public function removePrivilege(Employee $employee, EmployeePrivilege $privilege): RedirectResponse
    {
        abort_unless($privilege->employee_id === $employee->id, 404);

        $privilege->delete();

        return back()->with('success', 'Privillage Removed successfully');
    }

    private function isSignedIn(Employee $employee): bool
    {
        return $employee->is($this->currentEmployee());
    }
}
