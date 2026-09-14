<?php

namespace Tests\Feature\Api\Capital;

use App\Enums\Account;
use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\DividendAllocation;
use App\Models\DividendDeclaration;
use App\Models\DividendPayment;
use App\Models\Employee;
use App\Models\JournalEntry;
use App\Models\ShareHolder;
use App\Services\DividendService;
use App\Services\Ledger;
use App\Services\PeriodClose;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Mockery\MockInterface;
use RuntimeException;
use Tests\Feature\Api\Accounting\AccountingTestHelpers;
use Tests\TestCase;

/**
 * Capital → Dividends end to end: computed profit → Dividend Settings split → preview → declaration (ownership
 * snapshot, ledger) → full / partial payments with a locked balance check → reversal → history.
 */
class DividendApiTest extends TestCase
{
    use AccountingTestHelpers, RefreshDatabase;

    private const PERIOD = '2026-09';

    private Employee $admin;

    private ShareHolder $a;

    private ShareHolder $b;

    private ShareHolder $c;

    private BankAccount $bank;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo(CarbonImmutable::parse('2026-09-13 10:00:00'));
        $this->admin = $this->signInAdmin();
        $this->a = $this->holder('ALPHA');
        $this->b = $this->holder('BETA');
        $this->c = $this->holder('GAMMA');
        $this->bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $this->ledger()->openingBalance($this->admin->company_id, Account::Company, 50000000);
        $this->ledger()->openingBalance($this->admin->company_id, Account::Bank, 50000000, bankAccount: $this->bank);
    }

    public function test_profit_available_is_fetched_from_the_ledger_and_the_month_end_close(): void
    {
        $this->profit(250000);

        $this->getJson('/api/v1/capital/dividends/available-profit?period=2026-08')->assertOk()
            ->assertJsonPath('data.profit_available', 250000)
            ->assertJsonPath('data.source', DividendService::PROFIT_SOURCE_PROFIT_ACCOUNT)
            ->assertJsonPath('data.period_closed', false);

        $this->postIncome($this->admin->company_id, $this->admin->branch_id, 1000000, 0, 0, 0, '2026-08-15');
        $close = app(PeriodClose::class);
        $close->close($close->calculate($this->admin->company_id, CarbonImmutable::parse('2026-08-01')), $this->admin);

        $this->assertSame(1250000.0, $this->ledger()->balance($this->admin->company_id, Account::RetainedProfit, allBranches: true));
        $this->getJson('/api/v1/capital/dividends/available-profit?period=2026-08')->assertOk()
            ->assertJsonPath('data.profit_available', 980000)
            ->assertJsonPath('data.period_profit', 980000)
            ->assertJsonPath('data.source', DividendService::PROFIT_SOURCE_PERIOD_CLOSE)
            ->assertJsonPath('data.period_closed', true);
        $this->getJson('/api/v1/capital/dividends/summary?period=2026-08')->assertOk()
            ->assertJsonPath('data.profit_available', 980000)
            ->assertJsonPath('data.dividend_pool', 294000)
            ->assertJsonPath('data.reinvestment_amount', 686000);
    }

    public function test_profit_cannot_be_overridden_by_the_request(): void
    {
        $this->establish([[$this->a, 1000]]);
        $this->profit(1000000);

        $this->declare(['profit_amount' => 5000000])->assertUnprocessable()->assertJsonValidationErrors('profit_amount');
        $this->declare(['dividend_percent' => 90])->assertUnprocessable()->assertJsonValidationErrors('dividend_percent');
        $this->assertSame(0, DividendDeclaration::count());

        $this->declare()->assertCreated()->assertJsonPath('data.profit_amount', 1000000);
        $this->assertDatabaseHas('dividend_declarations', ['period' => '2026-09-01', 'profit_amount' => 1000000, 'dividend_amount' => 300000, 'profit_source' => 'profit_account']);
    }

    public function test_default_split_is_thirty_percent_shareholders_and_seventy_percent_reinvestment(): void
    {
        $this->getJson('/api/v1/settings/dividend')->assertOk()
            ->assertJsonPath('data.dividend_percent', 30)
            ->assertJsonPath('data.reinvest_percent', 70);

        $this->establish([[$this->a, 1000]]);
        $this->profit(1000000);
        $this->getJson('/api/v1/capital/dividends/preview?period='.self::PERIOD)->assertOk()
            ->assertJsonPath('data.dividend_percent', 30)
            ->assertJsonPath('data.reinvest_percent', 70)
            ->assertJsonPath('data.dividend_pool', 300000)
            ->assertJsonPath('data.reinvestment_amount', 700000);
    }

    public function test_changed_settings_are_used_by_later_declarations_only(): void
    {
        $this->establish([[$this->a, 600], [$this->b, 400]]);
        $this->profit(1000000);

        $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => '40', 'reinvest_percent' => '60'])
            ->assertOk()->assertJsonPath('message', 'Dividend Settings Updated successfully');
        $this->assertDatabaseHas('companies', ['id' => $this->admin->company_id, 'dividend_shareholder_percent' => 40, 'dividend_reinvest_percent' => 60]);
        $this->assertTrue(AuditLog::where('action', 'Company.dividend_settings_updated')->exists());

        $this->getJson('/api/v1/capital/dividends/preview?period='.self::PERIOD)->assertOk()
            ->assertJsonPath('data.dividend_pool', 400000)
            ->assertJsonPath('data.rows.0.entitlement', 240000)
            ->assertJsonPath('data.rows.1.entitlement', 160000);
        $this->declare()->assertCreated();

        $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => 50, 'reinvest_percent' => 50])->assertOk();
        $this->getJson('/api/v1/capital/dividends')->assertOk()
            ->assertJsonPath('data.0.dividend_percent', 40)
            ->assertJsonPath('data.0.reinvest_percent', 60)
            ->assertJsonPath('data.0.dividend_amount', 400000)
            ->assertJsonPath('data.0.reinvest_amount', 600000);
    }

    public function test_settings_must_total_exactly_one_hundred_percent(): void
    {
        $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => '30', 'reinvest_percent' => '69.99'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.dividend_percent.0', 'Shareholders Dividend % and Principal Reinvestment % must total exactly 100% (currently 99.99%).');

        $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => '30.01', 'reinvest_percent' => '69.99'])->assertOk();
        $this->getJson('/api/v1/settings/dividend')->assertJsonPath('data.dividend_percent', 30.01)->assertJsonPath('data.reinvest_percent', 69.99);
    }

    public function test_invalid_percentages_are_rejected(): void
    {
        $invalid = [
            [30, 80],
            [100, 10],
            [-5, 105],
            ['abc', 70],
            [30, null],
            ['30.123', '69.877'],
            [101, -1],
        ];

        foreach ($invalid as [$dividend, $reinvest]) {
            $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => $dividend, 'reinvest_percent' => $reinvest])->assertUnprocessable();
        }

        $this->assertDatabaseHas('companies', ['id' => $this->admin->company_id, 'dividend_shareholder_percent' => 30, 'dividend_reinvest_percent' => 70]);
    }

    public function test_pool_and_entitlements_are_decimal_exact(): void
    {
        $this->establish([[$this->a, 1], [$this->b, 1], [$this->c, 1]]);
        $this->profit(10000000.01);

        $this->declare()->assertCreated();
        $declaration = DividendDeclaration::firstOrFail();
        $this->assertSame('10000000.01', $declaration->profit_amount);
        $this->assertSame('3000000.00', $declaration->dividend_amount);
        $this->assertSame('7000000.01', $declaration->reinvest_amount);
        $this->assertSame('10000000.01', bcadd($declaration->dividend_amount, $declaration->reinvest_amount, 2));

        $amounts = DividendAllocation::orderBy('id')->pluck('amount')->all();
        $this->assertSame(['1000000.00', '1000000.00', '1000000.00'], $amounts);
    }

    public function test_leftover_cents_go_to_the_largest_remainder_so_entitlements_sum_to_the_pool(): void
    {
        $this->establish([[$this->a, 1], [$this->b, 1], [$this->c, 1]]);
        $this->profit(1000000.03);

        $this->declare()->assertCreated();
        $declaration = DividendDeclaration::firstOrFail();
        $this->assertSame('300000.01', $declaration->dividend_amount);
        $this->assertSame('700000.02', $declaration->reinvest_amount);
        $this->assertSame(['100000.01', '100000.00', '100000.00'], DividendAllocation::orderBy('id')->pluck('amount')->all());
        $this->assertSame('300000.01', DividendAllocation::all()->reduce(fn (string $sum, DividendAllocation $row): string => bcadd($sum, $row->amount, 2), '0'));
    }

    public function test_entitlements_follow_share_register_ownership(): void
    {
        $this->establish([[$this->a, 500], [$this->b, 300], [$this->c, 200]]);
        $this->profit(10000000);

        $this->getJson('/api/v1/capital/dividends/preview?period='.self::PERIOD)->assertOk()
            ->assertJsonPath('data.dividend_pool', 3000000)
            ->assertJsonPath('data.total_shares', 1000)
            ->assertJsonPath('data.rows.0.ownership_percent', 50)
            ->assertJsonPath('data.rows.0.entitlement', 1500000)
            ->assertJsonPath('data.rows.1.ownership_percent', 30)
            ->assertJsonPath('data.rows.1.entitlement', 900000)
            ->assertJsonPath('data.rows.2.ownership_percent', 20)
            ->assertJsonPath('data.rows.2.entitlement', 600000);

        $this->declare()->assertCreated();
        $this->assertSame(['1500000.00', '900000.00', '600000.00'], DividendAllocation::orderBy('id')->pluck('amount')->all());
    }

    public function test_ownership_is_snapshotted_on_the_declaration(): void
    {
        $this->establish([[$this->a, 500], [$this->b, 300], [$this->c, 200]]);
        $this->profit(10000000);
        $this->declare()->assertCreated();

        $declaration = DividendDeclaration::firstOrFail();
        $this->assertSame(1000, $declaration->total_shares);
        $this->assertSame('2026-09-13', $declaration->as_of_date->toDateString());

        $this->assertDatabaseHas('dividend_allocations', ['share_holder_id' => $this->a->id, 'shares_held' => 500, 'total_shares' => 1000, 'share_percent' => 50, 'amount' => 1500000, 'paid_amount' => 0, 'status' => 'unpaid']);
        $this->assertDatabaseHas('dividend_allocations', ['share_holder_id' => $this->c->id, 'shares_held' => 200, 'total_shares' => 1000, 'share_percent' => 20, 'amount' => 600000]);
    }

    public function test_later_share_transfers_and_issuances_do_not_change_historical_allocations(): void
    {
        $this->establish([[$this->a, 500], [$this->b, 300], [$this->c, 200]]);
        $this->profit(10000000);
        $this->declare()->assertCreated();
        $declaration = DividendDeclaration::firstOrFail();
        $before = $this->getJson("/api/v1/capital/dividends/{$declaration->id}/allocations")->assertOk()->json('data');

        $this->postJson('/api/v1/shares/transfers', ['from_share_holder_id' => $this->a->id, 'to_share_holder_id' => $this->c->id, 'shares' => 400])->assertCreated();
        $this->postJson('/api/v1/shares/issuances', ['share_holder_id' => $this->b->id, 'type' => 'bonus_issuance', 'shares' => 1000])->assertCreated();

        $this->getJson('/api/v1/capital/dividends/preview?period=2026-08')->assertOk()
            ->assertJsonPath('data.total_shares', 2000)
            ->assertJsonPath('data.rows.0.shares', 100);

        $after = $this->getJson("/api/v1/capital/dividends/{$declaration->id}/allocations")->assertOk()
            ->assertJsonPath('declaration.total_shares', 1000)
            ->json('data');
        $this->assertSame($before, $after);
        $this->assertSame([500, 300, 200], DividendAllocation::orderBy('id')->pluck('shares_held')->all());
    }

    public function test_declaration_is_persisted_with_its_breakdown_and_listed_in_history(): void
    {
        $this->establish([[$this->a, 600], [$this->b, 400]]);
        $this->profit(2000000);
        $this->declare()->assertCreated()->assertJsonPath('message', 'Dividend Declared successfully');

        $this->assertDatabaseHas('dividend_declarations', [
            'company_id' => $this->admin->company_id, 'period' => '2026-09-01', 'profit_amount' => 2000000, 'dividend_percent' => 30,
            'dividend_amount' => 600000, 'reinvest_percent' => 70, 'reinvest_amount' => 1400000, 'total_shares' => 1000,
            'as_of_date' => '2026-09-13', 'declared_by' => $this->admin->id,
        ]);
        $this->assertNotNull(DividendDeclaration::firstOrFail()->declared_at);

        $this->getJson('/api/v1/capital/dividends')->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.period_label', 'September 2026')
            ->assertJsonPath('data.0.shareholders', 2)
            ->assertJsonPath('data.0.paid_amount', 0)
            ->assertJsonPath('data.0.outstanding_amount', 600000)
            ->assertJsonPath('data.0.status', 'OPEN');
    }

    public function test_the_same_period_cannot_be_declared_twice(): void
    {
        $this->establish([[$this->a, 1000]]);
        $this->profit(2000000);
        $this->declare()->assertCreated();

        $this->declare()->assertUnprocessable()->assertJsonPath('errors.period.0', 'Dividends for September 2026 have already been declared.');
        $this->getJson('/api/v1/capital/dividends/preview?period='.self::PERIOD)->assertOk()
            ->assertJsonPath('data.already_declared', true)
            ->assertJsonPath('data.can_declare', false);
        $this->assertSame(1, DividendDeclaration::count());

        $this->expectException(ValidationException::class);
        app(DividendService::class)->declare($this->admin->company_id, CarbonImmutable::parse('2026-09-01'), $this->admin);
    }

    public function test_declaration_needs_profit_shareholders_and_a_past_or_current_month(): void
    {
        $this->declare()->assertUnprocessable()->assertJsonPath('errors.period.0', 'There is no profit available to distribute for September 2026.');

        $this->profit(100000);
        $this->declare()->assertUnprocessable()->assertJsonPath('errors.period.0', 'No shareholder holds shares in the share register to receive a dividend.');
        $this->declare(['period' => '2026-11'])->assertUnprocessable()->assertJsonValidationErrors('period');
        $this->assertSame(0, DividendDeclaration::count());
    }

    public function test_full_payment_marks_the_allocation_paid(): void
    {
        $allocation = $this->declaredAllocation();
        $cashBefore = $this->ledger()->balance($this->admin->company_id, Account::Company);

        $this->pay($allocation, ['amount' => '900,000'])->assertCreated()
            ->assertJsonPath('message', 'Dividend Paid successfully')
            ->assertJsonPath('data.allocation.balance', 0)
            ->assertJsonPath('data.allocation.status', 'paid');

        $this->assertSame($cashBefore - 900000, $this->ledger()->balance($this->admin->company_id, Account::Company));
        $this->assertSame('900000.00', $allocation->fresh()->paid_amount);
    }

    public function test_partial_payment_leaves_a_balance(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 250000.50])->assertCreated()
            ->assertJsonPath('data.allocation.paid_amount', 250000.5)
            ->assertJsonPath('data.allocation.balance', 649999.5);
    }

    public function test_overpayment_is_rejected(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 900000.01])->assertUnprocessable()
            ->assertJsonPath('errors.amount.0', 'The amount to pay cannot exceed the outstanding balance of TZS 900,000.00.');
        $this->assertSame(0, DividendPayment::count());
        $this->assertSame(3000000.0, $this->ledger()->balance($this->admin->company_id, Account::DividendPayable));
    }

    public function test_zero_amount_is_rejected(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 0])->assertUnprocessable()->assertJsonPath('errors.amount.0', 'The amount to pay must be greater than zero.');
        $this->pay($allocation, ['amount' => ''])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertSame(0, DividendPayment::count());
    }

    public function test_negative_amount_is_rejected(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => -100])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertSame(0, DividendPayment::count());

        $this->expectException(ValidationException::class);
        app(DividendService::class)->pay($allocation, '-100', 'CASH', null, null, $this->admin);
    }

    public function test_multiple_payments_reduce_the_balance(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 100000])->assertCreated()->assertJsonPath('data.allocation.balance', 800000);
        $this->pay($allocation, ['amount' => 200000, 'pay_method' => 'BANK', 'bank_account_id' => $this->bank->id])->assertCreated()->assertJsonPath('data.allocation.balance', 600000);
        $this->pay($allocation, ['amount' => 300000])->assertCreated()->assertJsonPath('data.allocation.balance', 300000);

        $this->assertSame('600000.00', $allocation->fresh()->paid_amount);
        $this->assertSame(600000, app(DividendService::class)->postedCents($allocation) / 100);
        $this->getJson("/api/v1/capital/dividends/allocations/{$allocation->id}/payments")->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('allocation.paid_amount', 600000)
            ->assertJsonPath('allocation.balance', 300000)
            ->assertJsonPath('allocation.last_payment_date', '2026-09-13');
    }

    public function test_final_payment_marks_the_allocation_paid(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 400000])->assertCreated();
        $this->pay($allocation, ['amount' => 500000])->assertCreated()->assertJsonPath('data.allocation.status', 'paid');

        $this->assertSame(DividendAllocation::STATUS_PAID, $allocation->fresh()->status);
        $this->pay($allocation, ['amount' => 1])->assertUnprocessable()->assertJsonPath('errors.amount.0', 'This dividend entitlement is already fully paid.');
        $this->getJson('/api/v1/capital/dividends/'.$allocation->dividend_declaration_id.'/allocations')->assertOk()
            ->assertJsonPath('data.1.status_label', 'PAID');
    }

    public function test_partial_payment_marks_the_allocation_partially_paid(): void
    {
        $allocation = $this->declaredAllocation();

        $this->pay($allocation, ['amount' => 1])->assertCreated()->assertJsonPath('data.allocation.status', 'partially_paid');

        $this->assertSame(DividendAllocation::STATUS_PARTIALLY_PAID, $allocation->fresh()->status);
        $this->getJson('/api/v1/capital/dividends/'.$allocation->dividend_declaration_id.'/allocations')->assertOk()
            ->assertJsonPath('data.0.status_label', 'UNPAID')
            ->assertJsonPath('data.1.status_label', 'PARTIALLY PAID')
            ->assertJsonPath('declaration.status', 'PARTIALLY PAID');
    }

    public function test_declaration_payment_and_reversal_ledger_entries_are_correct_and_balanced(): void
    {
        $allocation = $this->declaredAllocation();
        $declaration = $allocation->declaration;
        $companyId = $this->admin->company_id;

        $this->assertEntry($declaration->journal_entry_id, [
            [Account::RetainedProfit, null, 10000000, 0],
            [Account::Capital, null, 0, 7000000],
            [Account::DividendPayable, null, 0, 3000000],
        ]);
        $this->assertSame(0.0, $this->ledger()->balance($companyId, Account::RetainedProfit, allBranches: true));
        $this->assertSame(3000000.0, $this->ledger()->balance($companyId, Account::DividendPayable));

        $bankBefore = $this->ledger()->balance($companyId, Account::Bank, bankAccount: $this->bank);
        $paymentId = $this->pay($allocation, ['amount' => 400000, 'pay_method' => 'BANK', 'bank_account_id' => $this->bank->id, 'reference' => 'TRX-1'])->assertCreated()->json('data.id');
        $payment = DividendPayment::findOrFail($paymentId);
        $this->assertEntry($payment->journal_entry_id, [
            [Account::DividendPayable, null, 400000, 0],
            [Account::Bank, $this->bank->id, 0, 400000],
        ]);
        $this->assertSame((new DividendPayment)->getMorphClass(), JournalEntry::findOrFail($payment->journal_entry_id)->source_type);
        $this->assertSame(2600000.0, $this->ledger()->balance($companyId, Account::DividendPayable));
        $this->assertSame($bankBefore - 400000, $this->ledger()->balance($companyId, Account::Bank, bankAccount: $this->bank));

        $this->postJson("/api/v1/capital/dividends/payments/{$paymentId}/reverse", ['reason' => 'Paid to the wrong account'])->assertOk();
        $payment->refresh();
        $reversal = JournalEntry::findOrFail($payment->reversal_journal_entry_id);
        $this->assertSame($payment->journal_entry_id, $reversal->reversal_of_id);
        $this->assertEntry($reversal->id, [
            [Account::DividendPayable, null, 0, 400000],
            [Account::Bank, $this->bank->id, 400000, 0],
        ]);
        $this->assertSame(3000000.0, $this->ledger()->balance($companyId, Account::DividendPayable));
        $this->assertSame($bankBefore, $this->ledger()->balance($companyId, Account::Bank, bankAccount: $this->bank));

        foreach (JournalEntry::with('lines')->get() as $entry) {
            $this->assertSame(round((float) $entry->lines->sum('debit'), 2), round((float) $entry->lines->sum('credit'), 2), "Entry {$entry->description} is balanced");
        }
    }

    public function test_concurrent_payments_cannot_exceed_the_remaining_balance(): void
    {
        $allocation = $this->declaredAllocation();
        $stale = DividendAllocation::findOrFail($allocation->id);

        $this->pay($allocation, ['amount' => 600000, 'idempotency_key' => 'first'])->assertCreated();

        // The second request read the allocation before the first committed; the locked re-check still refuses it.
        DB::table('dividend_allocations')->where('id', $allocation->id)->update(['paid_amount' => 0, 'status' => 'unpaid']);
        try {
            app(DividendService::class)->pay($stale, '400000', 'CASH', null, null, $this->admin, 'second');
            $this->fail('The second payment should be refused.');
        } catch (ValidationException $exception) {
            $this->assertSame('The amount to pay cannot exceed the outstanding balance of TZS 300,000.00.', $exception->errors()['amount'][0]);
        }
        $this->pay($allocation, ['amount' => 400000, 'idempotency_key' => 'third'])->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->assertSame(1, DividendPayment::count());

        // A retried request with the same idempotency key returns the original payment without posting again.
        $entries = JournalEntry::count();
        $first = DividendPayment::firstOrFail();
        $this->pay($allocation, ['amount' => 600000, 'idempotency_key' => 'first'])->assertOk()
            ->assertJsonPath('data.id', $first->id)
            ->assertJsonPath('data.created', false);
        $this->pay($allocation, ['amount' => 1, 'idempotency_key' => 'first'])->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->assertSame($entries, JournalEntry::count());
        $this->assertSame(1, DividendPayment::count());
        $this->assertSame(2400000.0, $this->ledger()->balance($this->admin->company_id, Account::DividendPayable));
    }

    public function test_failed_ledger_posting_rolls_back_the_payment(): void
    {
        $allocation = $this->declaredAllocation();
        $this->partialMock(Ledger::class, fn (MockInterface $mock) => $mock->shouldReceive('journal')->andThrow(new RuntimeException('Ledger unavailable')));

        $this->withoutExceptionHandling();
        try {
            $this->pay($allocation, ['amount' => 100000]);
            $this->fail('The ledger failure should propagate.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Ledger unavailable', $exception->getMessage());
        }

        $this->assertSame(0, DividendPayment::count());
        $this->assertSame('0.00', $allocation->fresh()->paid_amount);
        $this->assertSame(DividendAllocation::STATUS_UNPAID, $allocation->fresh()->status);
    }

    public function test_unauthorized_users_cannot_declare_pay_reverse_or_change_settings(): void
    {
        $allocation = $this->declaredAllocation();
        $paymentId = $this->pay($allocation, ['amount' => 1000])->json('data.id');

        $finance = $this->employeeWithRole($this->admin, 'finance');
        $this->actingAs($finance);
        $this->getJson('/api/v1/capital/dividends')->assertForbidden();
        $this->postJson('/api/v1/capital/dividends', [])->assertForbidden();
        $this->postJson('/api/v1/capital/dividends', ['period' => '2026-08'])->assertForbidden();
        $this->postJson("/api/v1/capital/dividends/allocations/{$allocation->id}/pay", [])->assertForbidden();
        $this->postJson("/api/v1/capital/dividends/allocations/{$allocation->id}/pay", ['amount' => 1000, 'pay_method' => 'CASH'])->assertForbidden();
        $this->postJson("/api/v1/capital/dividends/payments/{$paymentId}/reverse", ['reason' => 'test'])->assertForbidden();
        $this->getJson('/api/v1/settings/dividend')->assertForbidden();
        $this->putJson('/api/v1/settings/dividend', [])->assertForbidden();
        $this->putJson('/api/v1/settings/dividend', ['dividend_percent' => 50, 'reinvest_percent' => 50])->assertForbidden();

        $capitalOnly = $this->employeeWithRole($this->admin, 'admin', ['capital.manage']);
        $this->actingAs($capitalOnly);
        $this->postJson("/api/v1/capital/dividends/payments/{$paymentId}/reverse", ['reason' => 'test'])->assertForbidden();

        $this->assertSame(1, DividendDeclaration::count());
        $this->assertSame(1, DividendPayment::count());
        $this->assertDatabaseHas('companies', ['id' => $this->admin->company_id, 'dividend_shareholder_percent' => 30]);
    }

    public function test_payment_history_is_retained_with_reversals(): void
    {
        $allocation = $this->declaredAllocation();
        $this->pay($allocation, ['amount' => 500000, 'reference' => 'RCPT-1'])->assertCreated();
        $second = $this->pay($allocation, ['amount' => 400000, 'pay_method' => 'BANK', 'bank_account_id' => $this->bank->id, 'reference' => 'TRX-2'])->json('data.id');
        $this->assertSame(DividendAllocation::STATUS_PAID, $allocation->fresh()->status);

        $this->postJson("/api/v1/capital/dividends/payments/{$second}/reverse", [])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->postJson("/api/v1/capital/dividends/payments/{$second}/reverse", ['reason' => 'Bank transfer bounced'])->assertOk()
            ->assertJsonPath('message', 'Dividend Payment Reversed successfully');
        $this->postJson("/api/v1/capital/dividends/payments/{$second}/reverse", ['reason' => 'Again'])->assertUnprocessable();

        $allocation->refresh();
        $this->assertSame(DividendAllocation::STATUS_PARTIALLY_PAID, $allocation->status);
        $this->assertSame('500000.00', $allocation->paid_amount);
        $this->assertSame(2, DividendPayment::count());
        $this->assertTrue(AuditLog::where('action', 'DividendPayment.updated')->exists());

        $history = $this->getJson('/api/v1/capital/dividends/payments')->assertOk()->assertJsonCount(2, 'data')->json('data');
        $reversed = collect($history)->firstWhere('id', $second);
        $this->assertSame('reversed', $reversed['status']);
        $this->assertSame('NMB', $reversed['account']);
        $this->assertSame('TRX-2', $reversed['reference']);
        $this->assertSame('Bank transfer bounced', $reversed['reversal_reason']);
        $this->assertNotNull($reversed['reversal_reference']);
        $this->assertNotNull($reversed['journal_reference']);
        $this->assertSame($this->admin->full_name, collect($history)->firstWhere('reference', 'RCPT-1')['paid_by']);
        $this->assertSame('COMPANY ACCOUNT', collect($history)->firstWhere('reference', 'RCPT-1')['account']);

        $this->pay($allocation, ['amount' => 400000.01])->assertUnprocessable();
        $this->pay($allocation, ['amount' => 400000])->assertCreated()->assertJsonPath('data.allocation.status', 'paid');
        $this->getJson('/api/v1/capital/dividends/summary?period='.self::PERIOD)->assertOk()
            ->assertJsonPath('data.total_declared', 3000000)
            ->assertJsonPath('data.total_paid', 900000)
            ->assertJsonPath('data.total_outstanding', 2100000);
    }

    public function test_records_of_another_company_are_not_reachable(): void
    {
        $allocation = $this->declaredAllocation();

        $this->signInAdmin();
        $this->getJson("/api/v1/capital/dividends/{$allocation->dividend_declaration_id}/allocations")->assertNotFound();
        $this->getJson("/api/v1/capital/dividends/allocations/{$allocation->id}/payments")->assertNotFound();
        $this->postJson("/api/v1/capital/dividends/allocations/{$allocation->id}/pay", ['amount' => 1, 'pay_method' => 'CASH'])->assertNotFound();
        $this->getJson('/api/v1/capital/dividends')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_legacy_fully_paid_allocations_are_backfilled_as_payment_rows(): void
    {
        $allocation = $this->declaredAllocation();
        $entry = $this->ledger()->transfer($this->admin->company_id, ['account' => Account::Company], ['account' => Account::DividendPayable], 900000, 'DIVIDEND PAYMENT LEGACY', $allocation);
        DB::table('dividend_allocations')->where('id', $allocation->id)->update(['status' => 'paid', 'pay_method' => 'CASH', 'reference' => 'OLD-1', 'paid_by' => $this->admin->id, 'paid_at' => now()]);
        DB::table('dividend_allocations')->where('id', '!=', $allocation->id)->update(['status' => 'pending']);

        $migration = require database_path('migrations/2026_09_14_170002_backfill_dividend_payments.php');
        $migration->up();
        $migration->up();

        $payment = DividendPayment::sole();
        $this->assertSame($allocation->id, $payment->dividend_allocation_id);
        $this->assertSame('900000.00', $payment->amount);
        $this->assertSame($entry->id, $payment->journal_entry_id);
        $this->assertSame('OLD-1', $payment->reference);
        $this->assertSame('900000.00', $allocation->fresh()->paid_amount);
        $this->assertSame(2, DividendAllocation::where('status', 'unpaid')->count());
    }

    private function ledger(): Ledger
    {
        return app(Ledger::class);
    }

    private function holder(string $firstName): ShareHolder
    {
        return ShareHolder::create(['company_id' => $this->admin->company_id, 'first_name' => $firstName, 'last_name' => 'HOLDER', 'mobile' => '0777', 'email' => strtolower($firstName).'@example.com', 'date_of_birth' => '1990-01-01']);
    }

    /**
     * Share structure with the given initial allocation (no cash).
     *
     * @param  list<array{0: ShareHolder, 1: int}>  $allocations
     */
    private function establish(array $allocations): void
    {
        $total = array_sum(array_column($allocations, 1));
        $this->postJson('/api/v1/shares/structure', [
            'capital_basis' => $total * 1000,
            'total_shares' => $total,
            'established_on' => '2026-09-13',
            'allocations' => array_map(fn (array $line): array => ['share_holder_id' => $line[0]->id, 'shares' => $line[1], 'treatment' => 'no_cash'], $allocations),
        ])->assertCreated();
    }

    /**
     * Profit already in the Profit Account (as posted by an earlier close).
     */
    private function profit(float $amount): void
    {
        $this->ledger()->journal($this->admin->company_id, 'MONTH END PROFIT', [
            ['account' => Account::InterestIncome, 'debit' => $amount, 'branch' => $this->admin->branch_id],
            ['account' => Account::RetainedProfit, 'credit' => $amount, 'branch' => $this->admin->branch_id],
        ]);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function declare(array $extra = []): TestResponse
    {
        return $this->postJson('/api/v1/capital/dividends', $extra + ['period' => self::PERIOD]);
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function pay(DividendAllocation $allocation, array $body): TestResponse
    {
        return $this->postJson("/api/v1/capital/dividends/allocations/{$allocation->id}/pay", $body + ['pay_method' => 'CASH']);
    }

    /**
     * BETA's allocation (30% = 900,000 of a 3,000,000 pool from a 10,000,000 profit).
     */
    private function declaredAllocation(): DividendAllocation
    {
        $this->establish([[$this->a, 500], [$this->b, 300], [$this->c, 200]]);
        $this->profit(10000000);
        $this->declare()->assertCreated();

        return DividendAllocation::where('share_holder_id', $this->b->id)->with('declaration')->firstOrFail();
    }

    /**
     * @param  list<array{0: Account, 1: ?int, 2: float|int, 3: float|int}>  $expected  account, bank account id, debit, credit
     */
    private function assertEntry(?int $entryId, array $expected): void
    {
        $entry = JournalEntry::with('lines.account')->findOrFail($entryId);
        $actual = $entry->lines->map(fn ($line): array => [$line->account->key instanceof Account ? $line->account->key->value : $line->account->key, $line->account->bank_account_id, (float) $line->debit, (float) $line->credit])->sortBy(fn (array $row): string => $row[0].$row[2])->values()->all();
        $wanted = collect($expected)->map(fn (array $row): array => [$row[0]->value, $row[1], (float) $row[2], (float) $row[3]])->sortBy(fn (array $row): string => $row[0].$row[2])->values()->all();

        $this->assertSame($wanted, $actual);
    }
}
