<?php

namespace App\Http\Controllers\SalaryAdvance;

use App\Enums\Account;
use App\Http\Controllers\Controller;
use App\Http\Requests\SalaryAdvance\SalaryAdvanceRequest;
use App\Models\Customer;
use App\Models\SalaryAdvance;
use App\Models\SalaryAdvanceCategory;
use App\Models\SalaryAdvancePayment;
use App\Services\Ledger;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class SalaryAdvanceController extends Controller
{
    public function __construct(private readonly Ledger $ledger) {}

    public function requested(Request $request): View
    {
        return view('salary-advance.requested', [
            'advances' => $this->advances($request, ['pending']),
            'branches' => $this->companyBranches(),
            'categories' => SalaryAdvanceCategory::where('company_id', $this->currentEmployee()->company_id)->orderBy('id')->get(),
        ]);
    }

    public function store(SalaryAdvanceRequest $request): RedirectResponse
    {
        $category = SalaryAdvanceCategory::findOrFail($request->integer('per_id'));
        $customer = Customer::findOrFail($request->integer('customer_id'));
        $amount = $request->float('loan_amount');

        if ($amount < (float) $category->amount_from || $amount > (float) $category->amount_to) {
            return back()->withInput()->with('error', 'Loan amount must be between '.money($category->amount_from).' - '.money($category->amount_to));
        }

        SalaryAdvance::create([
            'company_id' => $this->currentEmployee()->company_id,
            'branch_id' => $customer->branch_id,
            'customer_id' => $customer->id,
            'salary_advance_category_id' => $category->id,
            'amount' => $amount,
            'interest_rate' => $category->interest_rate,
            'total_payable' => round($amount * (1 + (float) $category->interest_rate / 100), 2),
            'fee' => $category->fee,
            'status' => 'pending',
        ]);

        return back()->with('success', 'Salary Advance Requested successfully');
    }

    /**
     * Ledger effect is inferred (not observable on the live system): the principal leaves the HQ
     * salary advance account and the category charge is booked to the branch loan fee account.
     */
    public function approve(SalaryAdvance $salaryAdvance): RedirectResponse
    {
        if ($salaryAdvance->status !== 'pending') {
            return back()->with('error', 'Salary advance is already approved');
        }

        DB::transaction(function () use ($salaryAdvance): void {
            $salaryAdvance->update(['status' => 'active', 'approved_at' => now()]);

            $this->ledger->journal($salaryAdvance->company_id, 'SALARY ADVANCE LOAN', [
                ['account' => Account::SalaryAdvanceReceivable, 'branch' => $salaryAdvance->branch_id, 'debit' => (float) $salaryAdvance->amount],
                ['account' => Account::HqSalaryAdvance, 'credit' => (float) $salaryAdvance->amount],
                ['account' => Account::LoanFee, 'branch' => $salaryAdvance->branch_id, 'debit' => (float) $salaryAdvance->fee],
                ['account' => Account::FeeIncome, 'branch' => $salaryAdvance->branch_id, 'credit' => (float) $salaryAdvance->fee],
            ], $salaryAdvance, null, $salaryAdvance->branch_id);
        });

        return back()->with('success', 'Salary Advance Aproved successfully');
    }

    /**
     * Deleting an approved advance reverses its ledger entries (inferred behaviour).
     */
    public function destroy(SalaryAdvance $salaryAdvance): RedirectResponse
    {
        DB::transaction(function () use ($salaryAdvance): void {
            if ($salaryAdvance->status !== 'pending') {
                $paid = (float) $salaryAdvance->payments()->sum('amount');
                $unrecovered = max(0, (float) $salaryAdvance->amount - $paid * (float) $salaryAdvance->amount / max(1, (float) $salaryAdvance->total_payable));
                $this->ledger->journal($salaryAdvance->company_id, 'SALARY ADVANCE REMOVED', [
                    ['account' => Account::HqSalaryAdvance, 'debit' => $unrecovered],
                    ['account' => Account::SalaryAdvanceReceivable, 'branch' => $salaryAdvance->branch_id, 'credit' => $unrecovered],
                    ['account' => Account::FeeIncome, 'branch' => $salaryAdvance->branch_id, 'debit' => (float) $salaryAdvance->fee],
                    ['account' => Account::LoanFee, 'branch' => $salaryAdvance->branch_id, 'credit' => (float) $salaryAdvance->fee],
                ], $salaryAdvance, null, $salaryAdvance->branch_id);
            }

            $salaryAdvance->delete();
        });

        return back()->with('success', 'Salary Advance Deleted successfully');
    }

    public function approved(Request $request): View
    {
        $advances = $this->query($request)
            ->whereIn('status', ['active', 'done'])
            ->whereDate('approved_at', today())
            ->get();

        return view('salary-advance.approved', [
            'advances' => $advances,
            'branches' => $this->companyBranches(),
        ]);
    }

    public function active(Request $request): View
    {
        return view('salary-advance.active', [
            'advances' => $this->advances($request, ['active'], dates: true),
            'branches' => $this->companyBranches(),
        ]);
    }

    /**
     * Repayment of an active salary advance. The payment returns to the HQ salary advance account.
     */
    public function pay(Request $request, SalaryAdvance $salaryAdvance): RedirectResponse
    {
        $request->validate(['amount' => ['required', 'numeric', 'min:1']]);

        if ($salaryAdvance->status !== 'active') {
            return back()->with('error', 'Salary advance is not active');
        }

        $amount = $request->float('amount');
        $remaining = $salaryAdvance->remaining_amount;

        if ($amount > $remaining + 0.001) {
            return back()->with('error', 'Amount is greater than remain amount ('.money($remaining).')');
        }

        DB::transaction(function () use ($salaryAdvance, $amount, $remaining): void {
            $payment = $salaryAdvance->payments()->create(['amount' => $amount, 'paid_on' => today()]);
            $principalShare = round($amount * (float) $salaryAdvance->amount / max(1, (float) $salaryAdvance->total_payable), 2);
            $this->ledger->journal($salaryAdvance->company_id, 'SALARY ADVANCE DEPOSIT', [
                ['account' => Account::HqSalaryAdvance, 'debit' => $amount],
                ['account' => Account::SalaryAdvanceReceivable, 'branch' => $salaryAdvance->branch_id, 'credit' => $principalShare],
                ['account' => Account::InterestIncome, 'branch' => $salaryAdvance->branch_id, 'credit' => $amount - $principalShare],
            ], $payment, null, $salaryAdvance->branch_id);

            if ($amount >= $remaining - 0.001) {
                $salaryAdvance->update(['status' => 'done']);
            }
        });

        return back()->with('success', 'Deposit successfully');
    }

    public function repayments(Request $request): View
    {
        return view('salary-advance.repayments', [
            'advances' => $this->advances($request, ['active', 'done']),
        ]);
    }

    public function paid(Request $request): View
    {
        $payments = SalaryAdvancePayment::query()
            ->whereHas('salaryAdvance', function (Builder $query) use ($request): void {
                $query->where('company_id', $this->currentEmployee()->company_id);
                if ($request->filled('blanch_id') && $request->input('blanch_id') !== 'all') {
                    $query->where('branch_id', $request->integer('blanch_id'));
                }
            })
            ->when(
                $request->filled('from') && $request->filled('to'),
                fn (Builder $query) => $query->whereBetween('paid_on', [$request->date('from')->toDateString(), $request->date('to')->toDateString()]),
                fn (Builder $query) => $query->whereDate('paid_on', today()),
            )
            ->with('salaryAdvance.customer', 'salaryAdvance.branch')
            ->latest('id')
            ->get();

        return view('salary-advance.paid', [
            'payments' => $payments,
            'branches' => $this->companyBranches(),
        ]);
    }

    /**
     * @param  list<string>  $statuses
     * @return Collection<int, SalaryAdvance>
     */
    private function advances(Request $request, array $statuses, bool $dates = false): Collection
    {
        return $this->query($request)
            ->whereIn('status', $statuses)
            ->when($dates && $request->filled('from') && $request->filled('to'), fn (Builder $query) => $query->whereBetween('created_at', [
                CarbonImmutable::parse($request->input('from'))->startOfDay(),
                CarbonImmutable::parse($request->input('to'))->endOfDay(),
            ]))
            ->get();
    }

    /**
     * @return Builder<SalaryAdvance>
     */
    private function query(Request $request): Builder
    {
        return SalaryAdvance::query()
            ->where('company_id', $this->currentEmployee()->company_id)
            ->when($request->filled('blanch_id') && $request->input('blanch_id') !== 'all', fn (Builder $query) => $query->where('branch_id', $request->integer('blanch_id')))
            ->with(['customer', 'branch', 'payments'])
            ->withSum('payments', 'amount')
            ->latest('id');
    }
}
