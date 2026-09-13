<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerType;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\LoanCategory;
use App\Models\MainCategory;
use App\Models\StaffLoanCategory;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * AJAX endpoints returning <option> markup for dependent dropdowns,
 * the same contract as the live system's fetch_* endpoints.
 */
class LookupController extends Controller
{
    public function employees(Request $request): Response
    {
        $employees = Employee::where('company_id', $this->currentEmployee()->company_id)
            ->where('branch_id', $request->integer('branch_id'))
            ->where('status', 'active')
            ->get();

        return $this->options('Select Employee', $employees->mapWithKeys(fn (Employee $employee): array => [$employee->id => $employee->full_name])->all());
    }

    public function customerTypes(Request $request): Response
    {
        $main = MainCategory::where('company_id', $this->currentEmployee()->company_id)->where('code', $request->string('work_status'))->first();
        $types = $main?->customerTypes()->where('is_enabled', true)->get() ?? collect();

        return $this->options('Select type of customer', $types->mapWithKeys(fn (CustomerType $type): array => [$type->code => $type->name])->all());
    }

    public function categoryDurations(Request $request): Response
    {
        $category = $this->category($request);

        return $this->options(null, $category ? [$category->duration->value => "{$category->duration->label()} / {$category->repayment_from} - {$category->repayment_to}"] : []);
    }

    public function categoryFormulas(Request $request): Response
    {
        $category = $this->category($request);

        return $this->options(null, $category ? [$category->formula => $category->formula] : []);
    }

    public function categoryFees(Request $request): Response
    {
        $category = $this->category($request);

        return $this->options(null, $category ? [$category->fee_deduct ? 'YES' : 'NO' => $category->fee_deduct ? 'YES' : 'NO'] : []);
    }

    public function customers(Request $request): Response
    {
        $customers = Customer::where('company_id', $this->currentEmployee()->company_id)
            ->where('branch_id', $request->integer('branch_id'))
            ->orderBy('first_name')
            ->get();

        return $this->options('Select customer', $customers->mapWithKeys(fn (Customer $customer): array => [$customer->id => $customer->full_name])->all());
    }

    public function customerLoans(Request $request): Response
    {
        $loans = Loan::where('company_id', $this->currentEmployee()->company_id)
            ->where('customer_id', $request->integer('customer_id'))
            ->with('category')
            ->latest('id')
            ->get();

        return $this->options('select loan', $loans->mapWithKeys(fn (Loan $loan): array => [$loan->id => "{$loan->category->name} / ".money($loan->amount_approved ?: $loan->amount_applied)." / {$loan->status->label()}"])->all());
    }

    public function staffLoanDurations(Request $request): Response
    {
        $category = StaffLoanCategory::where('company_id', $this->currentEmployee()->company_id)->find($request->integer('category_id'));

        return $this->options('Select Loan Duration', $category ? [$category->duration => ucfirst($category->duration)." / {$category->repayment_from} - {$category->repayment_to}"] : []);
    }

    private function category(Request $request): ?LoanCategory
    {
        return LoanCategory::where('company_id', $this->currentEmployee()->company_id)->find($request->integer('category_id'));
    }

    /**
     * @param  array<int|string, string>  $options
     */
    private function options(?string $placeholder, array $options): Response
    {
        $html = $placeholder !== null ? '<option value="">'.e($placeholder).'</option>' : '';
        foreach ($options as $value => $label) {
            $html .= '<option value="'.e((string) $value).'">'.e($label).'</option>';
        }

        return response($html);
    }
}
