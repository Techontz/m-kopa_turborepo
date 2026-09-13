<?php

namespace App\Http\Controllers\Expenses;

use App\Http\Controllers\Controller;
use App\Http\Requests\Expenses\ExpenseTypeRequest;
use App\Models\ExpenseType;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

/**
 * Expense names for the three live registers: branch expenses, headquarter expenses and bank expenses.
 */
class ExpenseTypeController extends Controller
{
    public function branch(): View
    {
        return $this->page('branch');
    }

    public function hq(): View
    {
        return $this->page('hq');
    }

    public function bank(): View
    {
        return $this->page('bank');
    }

    public function store(ExpenseTypeRequest $request): RedirectResponse
    {
        ExpenseType::create([
            'company_id' => $this->employee()->company_id,
            'scope' => $request->scope(),
            'name' => $request->expenseName(),
        ]);

        return back()->with('success', 'Expenses Registered successfully');
    }

    public function update(ExpenseTypeRequest $request, ExpenseType $expenseType): RedirectResponse
    {
        $expenseType->update(['name' => $request->expenseName()]);

        return back()->with('success', 'Expenses Updated successfully');
    }

    public function destroy(ExpenseType $expenseType): RedirectResponse
    {
        if ($expenseType->requests()->exists()) {
            return back()->with('error', 'Expenses has requests and cannot be deleted');
        }

        $expenseType->delete();

        return back()->with('success', 'Expenses Deleted successfully');
    }

    private function page(string $scope): View
    {
        return view('expenses.types', [
            'scope' => $scope,
            'field' => ExpenseTypeRequest::NAME_FIELDS[$scope],
            'types' => ExpenseType::where('company_id', $this->employee()->company_id)
                ->where('scope', $scope)
                ->orderBy('id')
                ->get(),
        ]);
    }
}
