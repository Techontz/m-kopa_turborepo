<?php

namespace Tests\Feature\Expenses;

use App\Enums\Account;
use App\Models\BankAccount;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\ExpenseRequest;
use App\Models\ExpenseType;
use App\Services\Ledger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExpenseRequestTest extends TestCase
{
    use RefreshDatabase;

    private Employee $admin;

    private Ledger $ledger;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->signInAdmin();
        $this->ledger = app(Ledger::class);
    }

    public function test_pages_render(): void
    {
        $this->get(route('expenses.requests'))->assertOk()->assertSee('Request Expenses')->assertSee('Recomended Expenses');
        $this->get(route('expenses.approve-section'))->assertOk()->assertSee('Aprove Section')->assertSee('Float Transaction');
        $this->get(route('expenses.accepted'))->assertOk()->assertSee('Accepted Expenses List');
        $this->get(route('hq-expenses.requests'))->assertOk()->assertSee('Headquater Recomended Expenses');
        $this->get(route('hq-expenses.approved'))->assertOk()->assertSee('Headquater Aproved Expenses');
        $this->get(route('bank-expenses.index'))->assertOk()->assertSee('Expenses List');
    }

    public function test_branch_request_is_accepted_and_debits_branch_principal(): void
    {
        $type = $this->type('branch', 'umeme');
        $this->ledger->post($this->admin->company_id, Account::Principal, 100000, 'Float', $this->admin->branch_id);

        $this->post(route('expense-requests.store'), [
            'scope' => 'branch',
            'blanch_id' => $this->admin->branch_id,
            'ex_id' => $type->id,
            'req_amount' => 50000,
            'req_description' => 'kulipa umeme',
        ])->assertRedirect();

        $request = ExpenseRequest::firstOrFail();
        $this->get(route('expenses.requests'))->assertSee('Not Accepted')->assertSee('kulipa umeme');

        $this->post(route('expense-requests.accept', $request), ['req_comment' => 'sawa', 'req_amount' => 45000])->assertRedirect();

        $request->refresh();
        $this->assertSame('accepted', $request->status);
        $this->assertSame('sawa', $request->comment);
        $this->assertSame(55000.0, $this->ledger->balance($this->admin->company_id, Account::Principal, $this->admin->branch_id));
        $this->get(route('expenses.accepted', ['blanch_id' => 'all']))->assertSee('45,000');
    }

    public function test_hq_request_debits_company_account(): void
    {
        $type = $this->type('hq', 'MAFUTA');

        $this->post(route('expense-requests.store'), [
            'scope' => 'hq', 'ex_id' => $type->id, 'req_amount' => 20000, 'req_description' => 'gari',
        ])->assertRedirect();

        $request = ExpenseRequest::firstOrFail();
        $this->assertNull($request->branch_id);
        $this->get(route('hq-expenses.requests'))->assertSee($this->admin->full_name);

        $this->post(route('expense-requests.accept', $request), ['req_amount' => 20000])->assertRedirect();

        $this->assertSame(-20000.0, $this->ledger->balance($this->admin->company_id, Account::Company));
        $this->get(route('hq-expenses.approved'))->assertSee('gari');
    }

    public function test_bank_request_debits_the_bank_account(): void
    {
        $type = $this->type('bank', 'MISHAHARA');
        $bank = BankAccount::create(['company_id' => $this->admin->company_id, 'name' => 'NMB']);
        $this->ledger->post($this->admin->company_id, Account::Bank, 16200, 'Deposit', bankAccount: $bank);

        $this->get(route('bank-expenses.index'))->assertSee('NMB - 16,200');

        $this->post(route('expense-requests.store'), [
            'scope' => 'bank', 'ac_id' => $bank->id, 'exp_id' => $type->id, 'amount' => 6200, 'comment' => 'mshahara',
        ])->assertRedirect();

        $request = ExpenseRequest::firstOrFail();
        $this->post(route('expense-requests.accept', $request))->assertRedirect();

        $this->assertSame('accepted', $request->fresh()->status);
        $this->assertSame(10000.0, $bank->balance());
    }

    public function test_accept_fails_when_branch_balance_is_insufficient(): void
    {
        $request = ExpenseRequest::create([
            'company_id' => $this->admin->company_id, 'scope' => 'branch', 'branch_id' => $this->admin->branch_id,
            'expense_type_id' => $this->type('branch', 'SODA')->id, 'amount' => 12000, 'status' => 'pending', 'request_date' => today(),
        ]);

        $this->post(route('expense-requests.accept', $request))->assertSessionHas('error');
        $this->assertSame('pending', $request->fresh()->status);
    }

    public function test_pending_request_can_be_deleted(): void
    {
        $request = ExpenseRequest::create([
            'company_id' => $this->admin->company_id, 'scope' => 'branch', 'branch_id' => $this->admin->branch_id,
            'expense_type_id' => $this->type('branch', 'SODA')->id, 'amount' => 12000, 'status' => 'pending', 'request_date' => today(),
        ]);

        $this->delete(route('expense-requests.destroy', $request))->assertRedirect();
        $this->assertModelMissing($request);
    }

    public function test_foreign_requests_are_not_reachable(): void
    {
        $foreignBranch = Branch::factory()->create();
        $foreignType = ExpenseType::create(['company_id' => $foreignBranch->company_id, 'scope' => 'branch', 'name' => 'umeme']);
        $request = ExpenseRequest::create([
            'company_id' => $foreignBranch->company_id, 'scope' => 'branch', 'branch_id' => $foreignBranch->id,
            'expense_type_id' => $foreignType->id, 'amount' => 1000, 'status' => 'pending', 'request_date' => today(),
        ]);

        $this->post(route('expense-requests.accept', $request))->assertNotFound();
        $this->delete(route('expense-requests.destroy', $request))->assertNotFound();
    }

    private function type(string $scope, string $name): ExpenseType
    {
        return ExpenseType::create(['company_id' => $this->admin->company_id, 'scope' => $scope, 'name' => $name]);
    }
}
