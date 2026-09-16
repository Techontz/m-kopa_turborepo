<?php

namespace Tests\Feature\Api\Payments;

use App\Enums\Account;
use App\Enums\PaymentStatus;
use App\Models\AuditLog;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Payment;
use App\Models\SmsLog;
use App\Models\TellerDeposit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Cash → Teller (PENDING_VERIFICATION) → bank deposit → Finance verify → confirm → allocation + SMS.
 */
class TellerCashFlowTest extends TestCase
{
    use InteractsWithRepayments;
    use RefreshDatabase;

    public function test_teller_page_shows_loan_and_outstanding_breakdown(): void
    {
        $admin = $this->signInAdmin();
        $loan = $this->activeLoan($admin, penalty: 10000);

        $this->getJson("/api/v1/teller/customers/{$loan->customer_id}")
            ->assertOk()
            ->assertJsonPath('data.loan.id', $loan->id)
            ->assertJsonPath('data.outstanding.principal', 100000)
            ->assertJsonPath('data.outstanding.penalty', 10000)
            ->assertJsonPath('data.outstanding.interest', 30000)
            ->assertJsonPath('data.available_to_deposit', 140000)
            ->assertJsonStructure(['data' => ['customer' => ['full_name', 'customer_code', 'photo_url'], 'cashbook' => ['opening', 'deposit', 'withdrawal', 'closing'], 'statement']]);
    }

    public function test_teller_cash_is_pending_verification_and_held_in_teller_cash(): void
    {
        $admin = $this->signInAdmin();
        $loan = $this->activeLoan($admin);
        $teller = $this->employeeWithRole($admin, 'teller');

        $this->actingAs($teller)
            ->postJson("/api/v1/teller/customers/{$loan->customer_id}/deposit", ['depost' => '50,000', 'p_method' => 'CASH', 'recept' => true])
            ->assertCreated()
            ->assertJsonPath('message', 'Deposit successfully')
            ->assertJsonPath('data.status', 'pending_verification')
            ->assertJsonPath('receipt', true);

        $payment = Payment::sole();
        $this->assertNotNull($payment->receipt_number);
        $this->assertSame(50000.0, $this->balance($admin, Account::TellerCash, $admin->branch_id, employeeId: $teller->id));
        // §11: unverified cash is held in the one central HQ pending account; the payment keeps its branch.
        $this->assertSame(50000.0, $this->balance($admin, Account::Suspense, null));
        $this->assertSame(0.0, $this->balance($admin, Account::Suspense, $admin->branch_id));
        $this->assertSame($admin->branch_id, $payment->branch_id);
        $this->assertSame(0, $loan->transactions()->where('type', 'deposit')->count());

        $this->actingAs($teller)->getJson("/api/v1/teller/receipts/{$payment->id}")->assertOk()->assertJsonPath('data.receipt_number', $payment->receipt_number);
    }

    public function test_deposit_validation_overpayment_and_permissions(): void
    {
        $admin = $this->signInAdmin();
        $loan = $this->activeLoan($admin);
        $url = "/api/v1/teller/customers/{$loan->customer_id}/deposit";

        $this->postJson($url, ['p_method' => 'CASH'])->assertUnprocessable()->assertJsonValidationErrors('depost');
        $this->postJson($url, ['depost' => 100000, 'p_method' => 'CASH'])->assertCreated();
        $this->postJson($url, ['depost' => 30001, 'p_method' => 'CASH'])->assertUnprocessable()->assertJsonValidationErrors('depost');

        $officer = $this->employeeWithRole($admin, 'loan_officer');
        $this->actingAs($officer)->postJson($url, ['depost' => 1000, 'p_method' => 'CASH'])->assertForbidden();

        $otherBranch = Branch::factory()->create(['company_id' => $admin->company_id]);
        $foreignTeller = $this->employeeWithRole($admin, 'teller', $otherBranch->id);
        $this->actingAs($foreignTeller)->getJson("/api/v1/teller/customers/{$loan->customer_id}")->assertForbidden();
        $this->actingAs($foreignTeller)->postJson($url, ['depost' => 1000, 'p_method' => 'CASH'])->assertForbidden();
    }

    public function test_bank_deposit_verification_confirmation_allocates_principal_first_and_clears_holding_accounts(): void
    {
        $admin = $this->signInAdmin();
        $loan = $this->activeLoan($admin, penalty: 10000);
        $teller = $this->employeeWithRole($admin, 'teller');
        $finance = $this->employeeWithRole($admin, 'finance');
        $bank = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'NMB']);

        $this->actingAs($teller)->postJson("/api/v1/teller/customers/{$loan->customer_id}/deposit", ['depost' => 105000, 'p_method' => 'CASH'])->assertCreated();
        $payment = Payment::sole();

        $this->actingAs($teller)->postJson('/api/v1/teller/bank-deposits', [
            'bank_account_id' => $bank->id, 'slip_number' => 'SLIP-0', 'amount' => 100000, 'deposit_date' => today()->toDateString(), 'payment_ids' => [$payment->id],
        ])->assertUnprocessable()->assertJsonValidationErrors(['amount' => 'The slip amount must equal the selected receipts (TZS 105,000.00).']);
        $this->assertSame(0, TellerDeposit::count());

        $this->actingAs($teller)->postJson('/api/v1/teller/bank-deposits', [
            'bank_account_id' => $bank->id, 'slip_number' => 'SLIP-1', 'amount' => 105000, 'deposit_date' => today()->toDateString(), 'payment_ids' => [$payment->id],
        ])->assertCreated();
        $deposit = TellerDeposit::sole();
        $this->assertSame(PaymentStatus::Deposited, $payment->fresh()->status);

        $this->actingAs($finance)->postJson("/api/v1/payments/reconciliation/{$deposit->id}/confirm")->assertUnprocessable();

        $this->actingAs($finance)->postJson("/api/v1/payments/reconciliation/{$deposit->id}/verify", ['statement_amount' => 100000, 'statement_reference' => 'NMB-778'])
            ->assertOk()->assertJsonPath('mismatch', true);
        $this->assertSame(TellerDeposit::STATUS_MISMATCH, $deposit->fresh()->status);

        $this->actingAs($finance)->postJson("/api/v1/payments/reconciliation/{$deposit->id}/reject", ['reason' => 'Slip amount differs from receipts'])->assertOk();
        $this->assertSame(PaymentStatus::PendingVerification, $payment->fresh()->status);

        $this->actingAs($teller)->postJson('/api/v1/teller/bank-deposits', [
            'bank_account_id' => $bank->id, 'slip_number' => 'SLIP-2', 'amount' => 105000, 'deposit_date' => today()->toDateString(), 'payment_ids' => [$payment->id],
        ])->assertCreated();
        $deposit = TellerDeposit::where('slip_number', 'SLIP-2')->sole();

        $this->actingAs($finance)->getJson('/api/v1/payments/reconciliation')->assertOk()->assertJsonPath('data.0.expected_amount', 105000);
        $this->actingAs($finance)->postJson("/api/v1/payments/reconciliation/{$deposit->id}/verify", ['statement_amount' => 105000, 'statement_reference' => 'NMB-779'])
            ->assertOk()->assertJsonPath('message', 'Deposit verified successfully');
        $this->actingAs($finance)->postJson("/api/v1/payments/reconciliation/{$deposit->id}/confirm")->assertOk()->assertJsonPath('message', 'Payment confirmed successfully');

        $transaction = $loan->transactions()->where('type', 'deposit')->sole();
        $this->assertEquals(100000, $transaction->principal);
        $this->assertEquals(5000, $transaction->penalty);
        $this->assertEquals(0, $transaction->interest);
        $this->assertSame(PaymentStatus::Confirmed, $payment->fresh()->status);
        $this->assertSame(TellerDeposit::STATUS_CONFIRMED, $deposit->fresh()->status);

        $this->assertSame(0.0, $this->balance($admin, Account::TellerCash, $admin->branch_id, employeeId: $teller->id));
        $this->assertSame(0.0, $this->balance($admin, Account::Suspense, $admin->branch_id));
        $this->assertSame(0.0, $this->balance($admin, Account::Bank, bankAccountId: $bank->id));
        $this->assertSame(0.0, $this->balance($admin, Account::LoanReceivable, $admin->branch_id));
        $this->assertSame(5000.0, $this->balance($admin, Account::PenaltyIncome, $admin->branch_id));
        $this->assertTrue(SmsLog::where('customer_id', $loan->customer_id)->where('message', 'like', '%yamethibitishwa%')->exists());
        $this->assertTrue(AuditLog::where('action', 'TellerDeposit.updated')->exists());
    }

    public function test_finance_rejects_pending_cash_with_ledger_reversal(): void
    {
        $admin = $this->signInAdmin();
        $loan = $this->activeLoan($admin);
        $this->postJson("/api/v1/teller/customers/{$loan->customer_id}/deposit", ['depost' => 20000, 'p_method' => 'CASH'])->assertCreated();
        $payment = Payment::sole();

        $this->postJson("/api/v1/payments/cash/{$payment->id}/reject", [])->assertUnprocessable()->assertJsonValidationErrors('reason');

        $teller = $this->employeeWithRole($admin, 'teller');
        $this->actingAs($teller)->postJson("/api/v1/payments/cash/{$payment->id}/reject", ['reason' => 'x'])->assertForbidden();

        $finance = $this->employeeWithRole($admin, 'finance');
        $this->actingAs($finance)->getJson('/api/v1/payments/cash?status=pending_verification')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($finance)->postJson("/api/v1/payments/cash/{$payment->id}/reject", ['reason' => 'Wrong customer'])->assertOk();

        $this->assertSame(PaymentStatus::Rejected, $payment->fresh()->status);
        $this->assertSame(0.0, $this->balance($admin, Account::Suspense, $admin->branch_id));
        $this->assertTrue($payment->journalEntry->reversal()->exists());
        $this->actingAs($finance)->postJson("/api/v1/payments/cash/{$payment->id}/reject", ['reason' => 'again'])->assertUnprocessable();
    }

    public function test_cash_verification_list_is_branch_scoped(): void
    {
        $admin = $this->signInAdmin();
        $otherBranch = Branch::factory()->create(['company_id' => $admin->company_id]);
        $mine = $this->activeLoan($admin);
        $theirs = $this->activeLoan($admin, branch: $otherBranch);
        $this->postJson("/api/v1/teller/customers/{$mine->customer_id}/deposit", ['depost' => 1000, 'p_method' => 'CASH'])->assertCreated();
        $this->postJson("/api/v1/teller/customers/{$theirs->customer_id}/deposit", ['depost' => 2000, 'p_method' => 'CASH'])->assertCreated();

        $this->getJson('/api/v1/payments/cash')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/api/v1/payments/cash?branch_id={$otherBranch->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.amount', 2000);

        $teller = $this->employeeWithRole($admin, 'teller');
        $this->actingAs($teller)->getJson('/api/v1/teller/cash')->assertOk()->assertJsonCount(0, 'data');
        $theirPayment = Payment::where('branch_id', $otherBranch->id)->sole();
        $bank = BankAccount::create(['company_id' => $admin->company_id, 'name' => 'CRDB']);
        $this->actingAs($teller)->postJson('/api/v1/teller/bank-deposits', [
            'bank_account_id' => $bank->id, 'slip_number' => 'S', 'amount' => 2000, 'deposit_date' => today()->toDateString(), 'payment_ids' => [$theirPayment->id],
        ])->assertForbidden();
    }
}
