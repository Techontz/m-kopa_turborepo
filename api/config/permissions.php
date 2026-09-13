<?php

/*
|--------------------------------------------------------------------------
| Permissions and default roles
|--------------------------------------------------------------------------
|
| Documents (ACCOUNT OVERVIEW "ROLE CONTROL", LOAN PROCESS, STAFF COMMISSION and
| the handwritten notes) define who may do what. Roles are stored per company and
| can be edited; these are the defaults seeded for a new company.
|
| Data scope: HQ roles see every branch, zone managers see the branches of their
| zone, branch roles see only their own branch.
|
*/

return [
    'permissions' => [
        'dashboard.view' => 'View dashboard',
        'settings.manage' => 'Manage branches, products, formulas, fees and settings',
        'users.manage' => 'Manage staff accounts and roles',
        'capital.view' => 'View capital and shareholder accounts',
        'capital.manage' => 'Register shareholders, add capital and distribute dividends',
        'float.manage' => 'Transfer float between company, branches and accounts',
        'bank.manage' => 'Manage bank accounts and bank transfers',
        'expenses.request' => 'Request expenses',
        'expenses.approve_branch' => 'Approve small branch expenses',
        'expenses.approve_hq' => 'Approve large and HQ expenses',
        'hq.manage' => 'Manage HQ accounts and transactions',
        'customers.view' => 'View customers',
        'customers.register' => 'Register customers and complete KYC',
        'customers.update' => 'Update customer information',
        'customers.categorize' => 'Assign customer categories',
        'loans.view' => 'View loans',
        'loans.apply' => 'Apply for loans on behalf of customers',
        'loans.approve_manager' => 'Branch manager loan approval',
        'loans.credit_review' => 'Credit officer review (telco verification)',
        'loans.prepare_disbursement' => 'Prepare disbursement batches',
        'loans.disburse' => 'Disburse and retry disbursements',
        'loans.write_off' => 'Write off defaulted loans',
        'payments.cash' => 'Record cash repayments (teller)',
        'payments.verify' => 'Verify cash deposits and reconcile bank statements',
        'payments.suspense' => 'Allocate unmatched payments from suspense',
        'accounting.view' => 'View chart of accounts, journals and balances',
        'accounting.reverse' => 'Post reversal entries',
        'accounting.close_period' => 'Run month-end profit and dividend processes',
        'salary_advance.manage' => 'Manage customer salary advances',
        'penalties.manage' => 'Manage penalties',
        'agent.manage' => 'Manage agent (clientless) transactions',
        'savings.manage' => 'Manage insurance savings',
        'visa.manage' => 'Manage customer bank card details',
        'reports.view' => 'View operational reports',
        'reports.financial' => 'View financial, commission and strategic reports',
        'hrm.manage' => 'Manage staff records, leave, allowances and deductions',
        'payroll.approve' => 'Generate and approve payroll and commission',
        'payroll.pay' => 'Pay approved payroll',
        'crm.use' => 'Use customer relationship tools',
        'messages.use' => 'Use internal messaging',
        'goals.manage' => 'Set goals and targets',
        'goals.view' => 'View goals and progress',
        'audit.view' => 'View audit trail',
    ],

    'roles' => [
        'super_admin' => ['name' => 'Super Admin', 'scope' => 'company', 'permissions' => ['*']],
        'admin' => ['name' => 'Admin', 'scope' => 'company', 'permissions' => [
            'dashboard.view', 'settings.manage', 'users.manage', 'float.manage', 'bank.manage', 'expenses.request',
            'expenses.approve_hq', 'hq.manage', 'customers.view', 'customers.update', 'loans.view', 'loans.write_off',
            'accounting.view', 'salary_advance.manage', 'penalties.manage', 'agent.manage', 'savings.manage', 'visa.manage',
            'reports.view', 'reports.financial', 'crm.use', 'messages.use', 'goals.manage', 'goals.view', 'audit.view',
        ]],
        'finance' => ['name' => 'Finance', 'scope' => 'company', 'permissions' => [
            'dashboard.view', 'float.manage', 'bank.manage', 'expenses.approve_branch', 'hq.manage', 'customers.view',
            'loans.view', 'loans.prepare_disbursement', 'loans.disburse', 'payments.verify', 'payments.suspense',
            'accounting.view', 'accounting.reverse', 'accounting.close_period', 'salary_advance.manage', 'penalties.manage',
            'agent.manage', 'savings.manage', 'payroll.pay', 'reports.view', 'reports.financial', 'messages.use', 'goals.view',
        ]],
        'hr' => ['name' => 'HR', 'scope' => 'company', 'permissions' => [
            'dashboard.view', 'users.manage', 'hrm.manage', 'payroll.approve', 'reports.view', 'messages.use', 'goals.view',
        ]],
        'zone_manager' => ['name' => 'Zone Manager', 'scope' => 'zone', 'permissions' => [
            'dashboard.view', 'customers.view', 'loans.view', 'reports.view', 'crm.use', 'messages.use', 'goals.view',
        ]],
        'branch_manager' => ['name' => 'Branch Manager', 'scope' => 'branch', 'permissions' => [
            'dashboard.view', 'customers.view', 'customers.register', 'customers.update', 'customers.categorize',
            'loans.view', 'loans.approve_manager', 'expenses.request', 'penalties.manage', 'reports.view', 'crm.use',
            'messages.use', 'goals.view',
        ]],
        'credit_officer' => ['name' => 'Credit Officer', 'scope' => 'company', 'permissions' => [
            'dashboard.view', 'customers.view', 'loans.view', 'loans.credit_review', 'reports.view', 'messages.use', 'goals.view',
        ]],
        'loan_officer' => ['name' => 'Loan Officer', 'scope' => 'branch', 'permissions' => [
            'dashboard.view', 'customers.view', 'customers.register', 'customers.update', 'customers.categorize',
            'loans.view', 'loans.apply', 'crm.use', 'messages.use', 'goals.view',
        ]],
        'teller' => ['name' => 'Teller', 'scope' => 'branch', 'permissions' => [
            'dashboard.view', 'customers.view', 'customers.register', 'loans.view', 'payments.cash', 'savings.manage',
            'messages.use', 'goals.view',
        ]],
    ],
];
