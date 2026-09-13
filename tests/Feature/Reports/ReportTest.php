<?php

namespace Tests\Feature\Reports;

use App\Enums\Duration;
use App\Enums\LoanStatus;
use App\Models\Branch;
use App\Models\Customer;
use App\Models\Employee;
use App\Models\Loan;
use App\Models\Penalty;
use App\Models\WriteOff;
use App\Services\LoanService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReportTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow('2026-09-13 10:00:00');
        $this->travelTo(CarbonImmutable::now());
        $this->admin = $this->signInAdmin();
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function pages(): array
    {
        return [
            'cash' => ['reports.cash', 'Transaction list'],
            'branchwise' => ['reports.branchwise', 'Branchwise Loan Summary'],
            'file' => ['reports.file', 'Filter Loan Collection'],
            'new loans' => ['reports.new-loans', 'FILE REPORT NEW LOAN / Year (2026)'],
            'pending' => ['reports.pending', 'Weekly loan pending'],
            'repayment' => ['reports.repayment', 'Loan Repayment'],
            'default' => ['reports.default', 'Daily Default Loan'],
            'write off' => ['reports.write-off', 'Wright-off Amount'],
            'write off done' => ['reports.write-off-done', 'bad debit Amount'],
            'collection' => ['reports.collection', 'Penart Amount'],
            'statement' => ['reports.statement', 'Search Customer'],
            'receivable' => ['reports.receivable', 'Weekly Receivable'],
            'received' => ['reports.received', 'Weekly Received'],
            'daily' => ['reports.daily', 'Daily Report / September, 13, 2026'],
            'development' => ['reports.development', 'Customer List'],
        ];
    }

    #[DataProvider('pages')]
    public function test_report_pages_render(string $routeName, string $label): void
    {
        $this->get(route($routeName))->assertOk()->assertSee($label);
    }

    public function test_cash_transactions_default_to_today_and_filter_by_branch(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $this->deposit($loan, 130000, today: true);
        $otherBranch = Branch::factory()->create(['company_id' => $this->admin->company_id]);

        $this->get(route('reports.cash'))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertSee('130,000');

        $this->get(route('reports.cash', ['blanch_id' => $otherBranch->id, 'from' => '2026-09-01', 'to' => '2026-09-13']))
            ->assertOk()
            ->assertViewHas('transactions', fn ($transactions): bool => $transactions->isEmpty());

        $this->get(route('reports.cash', ['blanch_id' => 'all', 'from' => '2026-09-06', 'to' => '2026-09-06']))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertSee('100,000');
    }

    public function test_branchwise_summary_totals_the_loan_book_and_splits_received_amounts(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $this->deposit($loan, 130000, today: true);

        $response = $this->get(route('reports.branchwise'))->assertOk();
        $rows = $response->viewData('rows');

        $this->assertSame(130000.0, $rows->first()['receivable']);
        $this->assertSame(100000.0, $rows->first()['receivable_principal']);
        $this->assertSame(130000.0, $rows->first()['received']);
        $this->assertSame(100000.0, $rows->first()['received_principal']);
        $this->assertSame(30000.0, $rows->first()['received_interest']);
        $this->assertSame(0.0, $rows->first()['pending']);

        $dated = $this->get(route('reports.branchwise', ['blanch_id' => 'all', 'from' => '2026-01-01', 'to' => '2026-01-31']))->viewData('rows');
        $this->assertSame(0.0, $dated->first()['receivable']);
    }

    public function test_file_report_adds_a_column_per_collection_month(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $this->deposit($loan, 50000, today: true);

        $this->get(route('reports.file', ['year' => 2026, 'blanch_id' => $this->admin->branch_id, 'loan_status' => 'ALL']))
            ->assertOk()
            ->assertSee('September')
            ->assertDontSee('January')
            ->assertSee($loan->customer->full_name)
            ->assertSee('80,000');

        $this->get(route('reports.new-loans'))->assertOk()->assertSee($loan->customer->full_name);
    }

    public function test_pending_lists_overdue_unpaid_instalments(): void
    {
        $loan = $this->activeLoan(daysAgo: 10);

        $this->get(route('reports.pending'))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertSee('2026-09-10');
    }

    public function test_default_loans_offer_the_write_off_action(): void
    {
        $loan = $this->activeLoan(daysAgo: 30);
        $loan->update(['status' => LoanStatus::Default]);

        $this->get(route('reports.default'))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertSee(route('loans.write-off', $loan))
            ->assertSee('Are you sure to wright-off');
    }

    public function test_write_off_lists_split_open_and_recovered_debts(): void
    {
        $open = $this->activeLoan(daysAgo: 30);
        $recovered = $this->activeLoan(daysAgo: 30);
        WriteOff::create(['loan_id' => $open->id, 'amount' => 130000, 'written_off_on' => '2026-09-01']);
        WriteOff::create(['loan_id' => $recovered->id, 'amount' => 90000, 'recovered_amount' => 90000, 'written_off_on' => '2026-09-01']);

        $this->get(route('reports.write-off'))->assertOk()->assertSee('130,000')
            ->assertViewHas('writeOffs', fn ($writeOffs): bool => $writeOffs->pluck('loan_id')->all() === [$open->id]);
        $this->get(route('reports.write-off-done'))->assertOk()->assertSee('90,000')
            ->assertViewHas('writeOffs', fn ($writeOffs): bool => $writeOffs->pluck('loan_id')->all() === [$recovered->id]);
    }

    public function test_collection_filters_by_status_and_shows_penalties(): void
    {
        $active = $this->activeLoan(daysAgo: 7);
        $pending = Loan::factory()->create(['customer_id' => $this->customer()->id]);
        Penalty::create([
            'company_id' => $active->company_id, 'branch_id' => $active->branch_id, 'customer_id' => $active->customer_id,
            'loan_id' => $active->id, 'amount' => 26000, 'penalty_date' => '2026-09-12',
        ]);

        $this->get(route('reports.collection'))
            ->assertOk()
            ->assertSee($active->customer->full_name)
            ->assertSee('26,000')
            ->assertViewHas('loans', fn ($loans): bool => $loans->pluck('id')->all() === [$active->id]);

        $this->get(route('reports.collection', ['blanch_id' => 'all', 'loan_status' => 'PENDING']))
            ->assertOk()
            ->assertViewHas('loans', fn ($loans): bool => $loans->pluck('id')->all() === [$pending->id]);
    }

    public function test_statement_shows_running_balances_for_the_selected_loan(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $this->deposit($loan, 50000, today: true);

        $response = $this->get(route('reports.statement', ['customer_id' => $loan->customer_id, 'loan_id' => $loan->id]))->assertOk();
        $rows = $response->viewData('rows');

        $this->assertCount(2, $rows);
        $this->assertSame(100000.0, $rows[0]['withdrawal']);
        $this->assertSame(130000.0, $rows[0]['remain']);
        $this->assertSame(50000.0, $rows[1]['balance']);
        $this->assertSame(80000.0, $rows[1]['remain']);
        $response->assertSee($loan->loan_number);
    }

    public function test_receivable_and_received_reports(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);

        $this->get(route('reports.receivable'))->assertOk()->assertSee($loan->customer->full_name)->assertSee('NOT PAID');

        $this->deposit($loan, 130000, today: true);

        $this->get(route('reports.receivable', ['blanch_id' => 'all', 'paid_status' => 'not paid', 'from' => '2026-09-13', 'to' => '2026-09-13']))
            ->assertOk()
            ->assertViewHas('schedules', fn ($schedules): bool => $schedules->isEmpty());

        $this->get(route('reports.received'))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertSee('30,000');
    }

    public function test_daily_report_opening_equals_previous_closing(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $this->deposit($loan, 130000, today: true);

        $today = $this->get(route('reports.daily'))->assertOk()->viewData('report');
        $yesterday = $this->get(route('reports.daily', ['blanch_id' => 'all', 'from' => '2026-09-12', 'to' => '2026-09-12']))->viewData('report');

        $this->assertSame(130000.0, $today['in']['DEPOSIT']);
        $this->assertSame(0.0, $yesterday['out']['LOAN WITHDRAWAL']);
        $this->assertSame($yesterday['closing'], $today['opening']);
        $this->assertEqualsWithDelta($today['opening'] + 130000, $today['closing'], 0.01);
    }

    public function test_marked_customers_and_their_development(): void
    {
        $loan = $this->activeLoan(daysAgo: 7);
        $loan->customer->update(['is_marked' => true]);
        $unmarked = $this->customer();

        $this->get(route('reports.development'))
            ->assertOk()
            ->assertSee($loan->customer->full_name)
            ->assertViewHas('customers', fn ($customers): bool => $customers->pluck('id')->all() === [$loan->customer_id] && $unmarked->exists);

        $this->get(route('reports.development.show', $loan->customer))
            ->assertOk()
            ->assertSee('Customer Development')
            ->assertSee($loan->loan_number)
            ->assertSee('Un- mark');
    }

    public function test_other_companies_data_is_not_reachable(): void
    {
        $foreignCustomer = Customer::factory()->create();

        $this->get(route('reports.development.show', $foreignCustomer))->assertNotFound();
        $this->get(route('reports.statement', ['customer_id' => $foreignCustomer->id]))->assertNotFound();
        $this->get(route('reports.cash', ['blanch_id' => $foreignCustomer->branch_id]))->assertNotFound();
    }

    private function customer(): Customer
    {
        return Customer::factory()->create(['branch_id' => $this->admin->branch_id]);
    }

    /**
     * A 100,000 weekly loan at 30% (130,000 over one instalment) cashed out $daysAgo days ago.
     */
    private function activeLoan(int $daysAgo): Loan
    {
        $loan = Loan::factory()->create([
            'customer_id' => $this->customer()->id,
            'amount_approved' => 100000,
            'duration' => Duration::Weekly,
            'status' => LoanStatus::Disbursed,
        ]);

        app(LoanService::class)->withdraw($loan, CarbonImmutable::today()->subDays($daysAgo), $this->admin);

        return $loan->fresh();
    }

    private function deposit(Loan $loan, float $amount, bool $today): void
    {
        app(LoanService::class)->deposit($loan->fresh(), $amount, $today ? CarbonImmutable::today() : CarbonImmutable::yesterday(), 'CASH', $this->admin);
    }
}
