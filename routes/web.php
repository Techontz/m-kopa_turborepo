<?php

use App\Http\Controllers\Agent\AgentTransactionController;
use App\Http\Controllers\Agent\PaymentModeController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Bank\BankAccountController;
use App\Http\Controllers\Bank\BankTransferController;
use App\Http\Controllers\Bank\PayrollController;
use App\Http\Controllers\Capital\CapitalController;
use App\Http\Controllers\Capital\FloatController;
use App\Http\Controllers\Capital\ShareHolderController;
use App\Http\Controllers\Customers\CustomerController;
use App\Http\Controllers\Customers\GuarantorController;
use App\Http\Controllers\Customers\RegistrationController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Expenses\ExpenseRequestController;
use App\Http\Controllers\Expenses\ExpenseTypeController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\Hq\HqTransactionController;
use App\Http\Controllers\Hrm\AllowanceController;
use App\Http\Controllers\Hrm\DeductionController;
use App\Http\Controllers\Hrm\EmployeeController;
use App\Http\Controllers\Hrm\LeaveController;
use App\Http\Controllers\Hrm\SalarySheetController;
use App\Http\Controllers\Hrm\StaffLoanCategoryController;
use App\Http\Controllers\Hrm\StaffLoanController;
use App\Http\Controllers\Hrm\StaffSalaryAdvanceCategoryController;
use App\Http\Controllers\Hrm\StaffSalaryAdvanceController;
use App\Http\Controllers\Loans\LoanApplicationController;
use App\Http\Controllers\Loans\LoanController;
use App\Http\Controllers\LookupController;
use App\Http\Controllers\PenaltyController;
use App\Http\Controllers\Reports\ReportController;
use App\Http\Controllers\SalaryAdvance\SalaryAdvanceCategoryController;
use App\Http\Controllers\SalaryAdvance\SalaryAdvanceController;
use App\Http\Controllers\SavingController;
use App\Http\Controllers\Settings\BranchController;
use App\Http\Controllers\Settings\CompanyController;
use App\Http\Controllers\Settings\FormulaController;
use App\Http\Controllers\Settings\LoanCategoryController;
use App\Http\Controllers\Settings\LoanFeeController;
use App\Http\Controllers\Settings\MainCategoryController;
use App\Http\Controllers\Settings\PenaltySettingController;
use App\Http\Controllers\Settings\ReserveSettingController;
use App\Http\Controllers\TellerController;
use App\Http\Controllers\VisaController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/', [LoginController::class, 'show'])->name('login');
    Route::post('welcome/signin', [LoginController::class, 'login'])->name('login.attempt');
});

Route::middleware('auth')->prefix('admin')->group(function (): void {
    Route::post('logout', [LoginController::class, 'logout'])->name('logout');

    Route::get('index', [DashboardController::class, 'index'])->name('dashboard');

    /* Lookups used by dependent dropdowns */
    Route::controller(LookupController::class)->prefix('lookup')->name('lookup.')->group(function (): void {
        Route::get('employees', 'employees')->name('employees');
        Route::get('customer-types', 'customerTypes')->name('customer-types');
        Route::get('category-durations', 'categoryDurations')->name('category-durations');
        Route::get('category-formulas', 'categoryFormulas')->name('category-formulas');
        Route::get('category-fees', 'categoryFees')->name('category-fees');
        Route::get('customers', 'customers')->name('customers');
        Route::get('customer-loans', 'customerLoans')->name('customer-loans');
        Route::get('staff-loan-durations', 'staffLoanDurations')->name('staff-loan-durations');
    });

    /* Settings */
    Route::controller(BranchController::class)->group(function (): void {
        Route::get('blanch', 'index')->name('branches.index');
        Route::post('blanch', 'store')->name('branches.store');
        Route::put('blanch/{branch}', 'update')->name('branches.update');
        Route::delete('blanch/{branch}', 'destroy')->name('branches.destroy');
    });
    Route::controller(FormulaController::class)->group(function (): void {
        Route::get('formular_setting', 'index')->name('formulas.index');
        Route::post('formular_setting/{formula}/enable', 'enable')->name('formulas.enable');
        Route::delete('formular_setting/{formula}', 'disable')->name('formulas.disable');
    });
    Route::controller(MainCategoryController::class)->group(function (): void {
        Route::get('main_loan_category', 'index')->name('main-categories.index');
        Route::post('main_loan_category/{mainCategory}/enable', 'enable')->name('main-categories.enable');
        Route::delete('main_loan_category/{mainCategory}', 'disable')->name('main-categories.disable');
        Route::get('sub_main_category/{mainCategory}', 'types')->name('main-categories.types');
        Route::post('sub_main_category/types/{customerType}/enable', 'enableType')->name('customer-types.enable');
        Route::delete('sub_main_category/types/{customerType}', 'disableType')->name('customer-types.disable');
    });
    Route::controller(LoanCategoryController::class)->group(function (): void {
        Route::get('loan_category', 'index')->name('loan-categories.index');
        Route::post('loan_category', 'store')->name('loan-categories.store');
        Route::get('edit_loan_category/{loanCategory}', 'edit')->name('loan-categories.edit');
        Route::put('edit_loan_category/{loanCategory}', 'update')->name('loan-categories.update');
        Route::delete('loan_category/{loanCategory}', 'destroy')->name('loan-categories.destroy');
        Route::get('loan_category_blanch/{loanCategory}', 'assignBranches')->name('loan-categories.branches');
        Route::post('loan_category_blanch/{loanCategory}/{branch}', 'attachBranch')->name('loan-categories.attach-branch');
        Route::delete('loan_category_blanch/{loanCategory}/{branch}', 'detachBranch')->name('loan-categories.detach-branch');
    });
    Route::controller(LoanFeeController::class)->group(function (): void {
        Route::get('loan_fee', 'index')->name('loan-fees.index');
        Route::put('loan_fee/mode', 'updateMode')->name('loan-fees.mode');
        Route::put('loan_fee/{loanCategory}', 'updateCategory')->name('loan-fees.update');
        Route::get('deducted_income', 'income')->name('loan-fees.income');
    });
    Route::get('penart_setting', [PenaltySettingController::class, 'edit'])->name('penalty-setting.edit');
    Route::put('penart_setting', [PenaltySettingController::class, 'update'])->name('penalty-setting.update');
    Route::get('reserve_setting', [ReserveSettingController::class, 'edit'])->name('reserve-setting.edit');
    Route::put('reserve_setting', [ReserveSettingController::class, 'update'])->name('reserve-setting.update');
    Route::controller(CompanyController::class)->group(function (): void {
        Route::get('setting', 'edit')->name('settings.company');
        Route::put('setting', 'update')->name('settings.company.update');
        Route::put('setting/password', 'password')->name('settings.password');
        Route::post('setting/logo', 'logo')->name('settings.logo');
    });

    /* Capital */
    Route::controller(ShareHolderController::class)->group(function (): void {
        Route::get('shareHolder', 'index')->name('share-holders.index');
        Route::post('shareHolder', 'store')->name('share-holders.store');
        Route::put('shareHolder/{shareHolder}', 'update')->name('share-holders.update');
        Route::delete('shareHolder/{shareHolder}', 'destroy')->name('share-holders.destroy');
    });
    Route::get('capital', [CapitalController::class, 'index'])->name('capitals.index');
    Route::post('capital', [CapitalController::class, 'store'])->name('capitals.store');
    Route::controller(FloatController::class)->group(function (): void {
        Route::get('transfar_amount', 'companyTransfers')->name('floats.company');
        Route::post('transfar_amount', 'storeCompany')->name('floats.company.store');
        Route::get('float_branch_branch', 'branch')->name('floats.branch');
        Route::post('float_branch_branch', 'storeBranch')->name('floats.branch.store');
        Route::post('float_branch_branch/{floatTransfer}/approve', 'approve')->name('floats.approve');
        Route::delete('float_branch_branch/{floatTransfer}', 'destroy')->name('floats.destroy');
        Route::get('aproved_float', 'approved')->name('floats.approved');
        Route::get('float_branch_ac_ac', 'accounts')->name('floats.accounts');
        Route::post('float_branch_ac_ac', 'storeAccounts')->name('floats.accounts.store');
    });

    /* Bank */
    Route::controller(BankAccountController::class)->group(function (): void {
        Route::get('banking_account', 'index')->name('bank-accounts.index');
        Route::post('banking_account', 'store')->name('bank-accounts.store');
        Route::put('banking_account/{bankAccount}', 'update')->name('bank-accounts.update');
        Route::delete('banking_account/{bankAccount}', 'destroy')->name('bank-accounts.destroy');
        Route::get('bank_balance', 'balance')->name('bank-accounts.balance');
    });
    Route::controller(BankTransferController::class)->group(function (): void {
        Route::get('bank_transaction_list', 'index')->name('bank-transfers.index');
        Route::post('bank_transaction_list', 'store')->name('bank-transfers.store');
        Route::post('bank_transaction_list/{bankTransfer}/approve', 'approve')->name('bank-transfers.approve');
        Route::delete('bank_transaction_list/{bankTransfer}', 'destroy')->name('bank-transfers.destroy');
        Route::get('get_aproved_transaction', 'approved')->name('bank-transfers.approved');
        Route::get('transfor_bank_amount', 'toBranch')->name('bank-transfers.to-branch');
        Route::post('transfor_bank_amount', 'storeToBranch')->name('bank-transfers.to-branch.store');
        Route::get('salary_advance_acc', 'toHq')->name('bank-transfers.to-hq');
        Route::post('salary_advance_acc', 'storeToHq')->name('bank-transfers.to-hq.store');
    });
    Route::get('payrol_expenses', [PayrollController::class, 'index'])->name('payroll.index');
    Route::get('view_expenses/{date}', [PayrollController::class, 'show'])->name('payroll.show');

    /* Expense types (branch / HQ / bank) and requests */
    Route::controller(ExpenseTypeController::class)->group(function (): void {
        Route::get('expenses', 'branch')->name('expense-types.branch');
        Route::get('hq_expenses', 'hq')->name('expense-types.hq');
        Route::get('account_expenses', 'bank')->name('expense-types.bank');
        Route::post('expense_types', 'store')->name('expense-types.store');
        Route::put('expense_types/{expenseType}', 'update')->name('expense-types.update');
        Route::delete('expense_types/{expenseType}', 'destroy')->name('expense-types.destroy');
    });
    Route::controller(ExpenseRequestController::class)->group(function (): void {
        Route::get('get_recomended_request', 'branchRequests')->name('expenses.requests');
        Route::get('aprove_section', 'branchRequests')->name('expenses.approve-section');
        Route::get('get_accepted_expenses', 'branchAccepted')->name('expenses.accepted');
        Route::get('get_hq_expenses_request', 'hqRequests')->name('hq-expenses.requests');
        Route::get('get_hq_expenses_aproved', 'hqApproved')->name('hq-expenses.approved');
        Route::get('expenses_account_request', 'bankRequests')->name('bank-expenses.index');
        Route::post('expense_requests', 'store')->name('expense-requests.store');
        Route::post('expense_requests/{expenseRequest}/accept', 'accept')->name('expense-requests.accept');
        Route::delete('expense_requests/{expenseRequest}', 'destroy')->name('expense-requests.destroy');
    });

    /* Headquarter transactions */
    Route::controller(HqTransactionController::class)->group(function (): void {
        Route::get('hq_account_balance', 'balance')->name('hq-transactions.balance');
        Route::get('request_headqueter', 'requests')->name('hq-transactions.requests');
        Route::post('request_headqueter', 'store')->name('hq-transactions.store');
        Route::post('request_headqueter/{hqTransaction}/approve', 'approve')->name('hq-transactions.approve');
        Route::get('request_headqueter_aproved', 'approved')->name('hq-transactions.approved');
    });

    /* Customer salary advance */
    Route::controller(SalaryAdvanceCategoryController::class)->group(function (): void {
        Route::get('perifelar_setting', 'index')->name('salary-advance-categories.index');
        Route::post('perifelar_setting', 'store')->name('salary-advance-categories.store');
        Route::put('perifelar_setting/{salaryAdvanceCategory}', 'update')->name('salary-advance-categories.update');
        Route::delete('perifelar_setting/{salaryAdvanceCategory}', 'destroy')->name('salary-advance-categories.destroy');
    });
    Route::controller(SalaryAdvanceController::class)->group(function (): void {
        Route::get('perifelar_debit_requested', 'requested')->name('salary-advances.requested');
        Route::post('perifelar_debit_requested', 'store')->name('salary-advances.store');
        Route::post('perifelar_debit/{salaryAdvance}/approve', 'approve')->name('salary-advances.approve');
        Route::delete('perifelar_debit/{salaryAdvance}', 'destroy')->name('salary-advances.destroy');
        Route::get('perifelar_debit_aproved', 'approved')->name('salary-advances.approved');
        Route::get('perifelar_debit_list', 'active')->name('salary-advances.active');
        Route::post('perifelar_debit/{salaryAdvance}/pay', 'pay')->name('salary-advances.pay');
        Route::get('get_perfelar_loan_done', 'repayments')->name('salary-advances.repayments');
        Route::get('deposit_history_per_all', 'paid')->name('salary-advances.paid');
    });

    /* Penalties */
    Route::controller(PenaltyController::class)->group(function (): void {
        Route::get('get_penart_list', 'index')->name('penalties.index');
        Route::post('get_penart_list/{penalty}/pay', 'pay')->name('penalties.pay');
        Route::post('get_penart_list/{penalty}/waive', 'waive')->name('penalties.waive');
        Route::get('penart_paid_list', 'paid')->name('penalties.paid');
    });

    /* Customers */
    Route::controller(RegistrationController::class)->group(function (): void {
        Route::get('basic_info', 'create')->name('customers.create');
        Route::post('basic_info', 'store')->name('customers.store');
        Route::get('basic_info_data/{customer}', 'editBasic')->name('customers.basic');
        Route::put('basic_info_data/{customer}', 'updateBasic')->name('customers.basic.update');
        Route::get('aditinal_detail/{customer}', 'additional')->name('customers.additional');
        Route::put('aditinal_detail/{customer}', 'storeAdditional')->name('customers.additional.store');
        Route::get('pass_port_document/{customer}', 'passport')->name('customers.passport');
        Route::post('upload_image/{customer}', 'uploadPhoto')->name('customers.photo');
        Route::post('upload_natinal_card/{customer}', 'storeDocuments')->name('customers.documents');
    });
    Route::controller(CustomerController::class)->group(function (): void {
        Route::get('all_customer', 'index')->name('customers.index');
        Route::get('update_customer_info_data', 'search')->name('customers.search');
        Route::get('customer_profile/{customer}', 'show')->name('customers.show');
        Route::put('customer_profile/{customer}/basic', 'updateBasic')->name('customers.profile.basic');
        Route::put('customer_profile/{customer}/additional', 'updateAdditional')->name('customers.profile.additional');
        Route::post('customer_profile/{customer}/documents', 'updateDocuments')->name('customers.profile.documents');
        Route::post('customer_profile/{customer}/kyc', 'approveKyc')->name('customers.kyc');
        Route::post('customer_profile/{customer}/mark', 'mark')->name('customers.mark');
        Route::post('customer_profile/{customer}/sms', 'sendSms')->name('customers.sms');
        Route::delete('customer_profile/{customer}', 'destroy')->name('customers.destroy');
        Route::get('view_customer_monthly', 'byDuration')->defaults('duration', 'monthly')->name('customers.monthly');
        Route::get('view_customer_weekly', 'byDuration')->defaults('duration', 'weekly')->name('customers.weekly');
        Route::get('view_customer_daily', 'byDuration')->defaults('duration', 'daily')->name('customers.daily');
    });
    Route::controller(GuarantorController::class)->group(function (): void {
        Route::post('customer/{customer}/guarantors', 'store')->name('guarantors.store');
        Route::put('guarantors/{guarantor}', 'update')->name('guarantors.update');
        Route::delete('guarantors/{guarantor}', 'destroy')->name('guarantors.destroy');
    });

    /* Groups */
    Route::controller(GroupController::class)->group(function (): void {
        Route::get('group', 'index')->name('groups.index');
        Route::post('group', 'store')->name('groups.store');
        Route::put('group/{group}', 'update')->name('groups.update');
        Route::delete('group/{group}', 'destroy')->name('groups.destroy');
        Route::get('view_customer_group/{group}', 'show')->name('groups.show');
    });

    /* Loans */
    Route::controller(LoanApplicationController::class)->group(function (): void {
        Route::get('loan_application', 'index')->name('loans.application');
        Route::get('edit_viewSponser/{customer}', 'start')->name('loans.start');
        Route::get('loan_applicationForm/{customer}', 'form')->name('loans.form');
        Route::post('loan_applicationForm/{customer}', 'store')->name('loans.store');
        Route::get('loan_sponser/{loan}', 'securities')->name('loans.securities');
        Route::post('loan_sponser/{loan}/guarantor', 'storeGuarantor')->name('loans.securities.guarantor');
        Route::post('loan_sponser/{loan}/collateral', 'storeCollateral')->name('loans.securities.collateral');
        Route::delete('loan_sponser/collateral/{collateral}', 'destroyCollateral')->name('loans.securities.collateral.destroy');
    });
    Route::controller(LoanController::class)->group(function (): void {
        Route::get('loan_pending', 'pending')->name('loans.pending');
        Route::get('loan_pending_recomended', 'special')->name('loans.special');
        Route::get('view_Dataloan/{loan}', 'show')->name('loans.show');
        Route::get('edit_loan/{loan}', 'edit')->name('loans.edit');
        Route::put('edit_loan/{loan}', 'update')->name('loans.update');
        Route::post('edit_loan/{loan}/collateral-attachment', 'updateCollateralAttachment')->name('loans.collateral-attachment');
        Route::post('aprove_loan/{loan}', 'approve')->name('loans.approve');
        Route::post('reject_loan/{loan}', 'reject')->name('loans.reject');
        Route::delete('delete_loan/{loan}', 'destroy')->name('loans.destroy');
        Route::get('disburse_loan', 'disbursed')->name('loans.disbursed');
        Route::post('upload_loan_agrement/{loan}', 'uploadAgreement')->name('loans.agreement');
        Route::get('print_customer_agreement/{loan}', 'agreement')->name('loans.agreement.print');
        Route::get('loan_withdrawal', 'withdrawals')->name('loans.withdrawal');
        Route::get('all_loan_lejected', 'rejected')->name('loans.rejected');
        Route::post('wright_off_loan/{loan}', 'writeOff')->name('loans.write-off');
    });

    /* Teller */
    Route::controller(TellerController::class)->group(function (): void {
        Route::get('teller_dashboard', 'index')->name('teller.index');
        Route::get('data_with_depost/{customer}', 'show')->name('teller.show');
        Route::post('deposit_loan/{loan}', 'deposit')->name('teller.deposit');
        Route::post('create_withdrow_balance/{loan}', 'withdraw')->name('teller.withdraw');
    });

    /* Agent (clientless transactions) */
    Route::controller(PaymentModeController::class)->group(function (): void {
        Route::get('mode_payment', 'index')->name('payment-modes.index');
        Route::post('mode_payment', 'store')->name('payment-modes.store');
        Route::delete('mode_payment/{paymentMode}', 'destroy')->name('payment-modes.destroy');
    });
    Route::controller(AgentTransactionController::class)->group(function (): void {
        Route::get('transaction_record', 'record')->name('agent-transactions.record');
        Route::get('today_transaction_miamala', 'deposits')->name('agent-transactions.deposit');
        Route::post('create_miamala', 'store')->name('agent-transactions.store');
    });

    /* Insurance savings */
    Route::controller(SavingController::class)->group(function (): void {
        Route::get('saving_customer', 'search')->name('savings.search');
        Route::get('saving_customer/{customer}', 'show')->name('savings.show');
        Route::post('saving_customer/{customer}', 'store')->name('savings.store');
        Route::get('deposit_saving_today', 'deposits')->name('savings.deposits');
        Route::get('get_withdrawal_saving', 'withdrawals')->name('savings.withdrawals');
        Route::get('saving_balance_customer', 'balance')->name('savings.balance');
    });

    Route::get('bank_password', [VisaController::class, 'index'])->name('visa.index');
    Route::put('bank_password/{customer}', [VisaController::class, 'update'])->name('visa.update');

    /* Reports */
    Route::controller(ReportController::class)->name('reports.')->group(function (): void {
        Route::get('cash_transaction', 'cash')->name('cash');
        Route::get('blanchiwise_report', 'branchwise')->name('branchwise');
        Route::get('collection_data', 'file')->name('file');
        Route::get('get_newLoan', 'newLoans')->name('new-loans');
        Route::get('loan_pending_time', 'pending')->name('pending');
        Route::get('repaymant_data', 'repayment')->name('repayment');
        Route::get('get_outstand_loan', 'default')->name('default');
        Route::get('write_off_data', 'writeOff')->name('write-off');
        Route::get('get_bad_debit_done', 'writeOffDone')->name('write-off-done');
        Route::get('loan_collection', 'collection')->name('collection');
        Route::get('customer_account_statement', 'statement')->name('statement');
        Route::get('today_recevable_loan', 'receivable')->name('receivable');
        Route::get('today_receved_loan', 'received')->name('received');
        Route::get('daily_report', 'daily')->name('daily');
        Route::get('marked_customer_list', 'development')->name('development');
        Route::get('view_customer_development/{customer}', 'developmentShow')->name('development.show');
    });

    /* HRM */
    Route::controller(EmployeeController::class)->group(function (): void {
        Route::get('all_employee', 'index')->name('employees.index');
        Route::get('all_rejected_employee', 'rejected')->name('employees.rejected');
        Route::get('view_blanchEmployee', 'byBranch')->name('employees.by-branch');
        Route::post('all_employee', 'store')->name('employees.store');
        Route::get('view_employee/{employee}', 'show')->name('employees.show');
        Route::put('view_employee/{employee}', 'update')->name('employees.update');
        Route::post('view_employee/{employee}/photo', 'photo')->name('employees.photo');
        Route::post('view_employee/{employee}/salary', 'salary')->name('employees.salary');
        Route::put('view_employee/{employee}/password', 'password')->name('employees.password');
        Route::post('block_employee/{employee}', 'toggleBlock')->name('employees.block');
        Route::post('reject_employee/{employee}', 'reject')->name('employees.reject');
        Route::post('reset_panel/{employee}', 'resetPassword')->name('employees.reset');
        Route::delete('delete_employee/{employee}', 'destroy')->name('employees.destroy');
        Route::get('privillage/{employee}', 'privileges')->name('employees.privileges');
        Route::post('privillage/{employee}', 'addPrivilege')->name('employees.privileges.add');
        Route::delete('privillage/{employee}/{privilege}', 'removePrivilege')->name('employees.privileges.remove');
    });
    Route::get('leave', [LeaveController::class, 'index'])->name('leaves.index');
    Route::post('leave', [LeaveController::class, 'store'])->name('leaves.store');
    Route::get('staff_allowance', [AllowanceController::class, 'index'])->name('allowances.index');
    Route::post('staff_allowance', [AllowanceController::class, 'store'])->name('allowances.store');
    Route::get('staf_deduction', [DeductionController::class, 'index'])->name('deductions.index');
    Route::post('staf_deduction', [DeductionController::class, 'store'])->name('deductions.store');
    Route::get('salary_sheet', [SalarySheetController::class, 'index'])->name('salary-sheet.index');
    Route::post('salary_sheet/pay', [SalarySheetController::class, 'pay'])->name('salary-sheet.pay');
    Route::controller(StaffSalaryAdvanceController::class)->group(function (): void {
        Route::get('sallry_advance', 'index')->name('staff-salary-advances.index');
        Route::post('sallry_advance', 'store')->name('staff-salary-advances.store');
        Route::post('sallry_advance/{staffSalaryAdvance}/approve', 'approve')->name('staff-salary-advances.approve');
        Route::post('sallry_advance/{staffSalaryAdvance}/reject', 'reject')->name('staff-salary-advances.reject');
    });
    Route::controller(StaffLoanController::class)->group(function (): void {
        Route::get('staff_loan', 'index')->name('staff-loans.index');
        Route::post('staff_loan', 'store')->name('staff-loans.store');
        Route::post('staff_loan/{staffLoan}/approve', 'approve')->name('staff-loans.approve');
        Route::get('staff_loan_active', 'active')->name('staff-loans.active');
        Route::post('staff_loan/{staffLoan}/pay', 'pay')->name('staff-loans.pay');
    });
    Route::controller(StaffLoanCategoryController::class)->group(function (): void {
        Route::get('empl_loan_category', 'index')->name('staff-loan-categories.index');
        Route::post('empl_loan_category', 'store')->name('staff-loan-categories.store');
        Route::put('empl_loan_category/{staffLoanCategory}', 'update')->name('staff-loan-categories.update');
        Route::delete('empl_loan_category/{staffLoanCategory}', 'destroy')->name('staff-loan-categories.destroy');
    });
    Route::controller(StaffSalaryAdvanceCategoryController::class)->group(function (): void {
        Route::get('staff_salary_category', 'index')->name('staff-salary-advance-categories.index');
        Route::post('staff_salary_category', 'store')->name('staff-salary-advance-categories.store');
        Route::put('staff_salary_category/{staffSalaryAdvanceCategory}', 'update')->name('staff-salary-advance-categories.update');
        Route::delete('staff_salary_category/{staffSalaryAdvanceCategory}', 'destroy')->name('staff-salary-advance-categories.destroy');
    });
});
