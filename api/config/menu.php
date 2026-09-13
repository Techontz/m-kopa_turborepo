<?php

/*
|--------------------------------------------------------------------------
| Sidebar navigation
|--------------------------------------------------------------------------
|
| Mirrors the three sidebar tabs of the live system (Menu / Report / HRM),
| including its labels and ordering. Items reference named routes.
|
*/

return [
    'menu' => [
        'label' => 'Menu',
        'items' => [
            ['label' => 'Dashboard', 'icon' => 'icon-home', 'route' => 'dashboard'],
            ['label' => 'Settings', 'icon' => 'icon-settings', 'children' => [
                ['label' => 'Branch', 'route' => 'branches.index'],
                ['label' => 'Interest Formular', 'route' => 'formulas.index'],
                ['label' => 'Main Loan Category', 'route' => 'main-categories.index'],
                ['label' => 'Loan Category', 'route' => 'loan-categories.index'],
                ['label' => 'Loan Fee', 'route' => 'loan-fees.index'],
                ['label' => 'Penalty', 'route' => 'penalty-setting.edit'],
                ['label' => 'Reserve Setting', 'route' => 'reserve-setting.edit'],
            ]],
            ['label' => 'Capital', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Share Holders', 'route' => 'share-holders.index'],
                ['label' => 'Add Capitals', 'route' => 'capitals.index'],
                ['label' => 'Float', 'route' => 'floats.company'],
                ['label' => 'Float Branch To Branch', 'route' => 'floats.branch'],
                ['label' => 'Aproved Float', 'route' => 'floats.approved'],
                ['label' => 'Float Ac-Ac', 'route' => 'floats.accounts'],
            ]],
            ['label' => 'Bank', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Register Account', 'route' => 'bank-accounts.index'],
                ['label' => 'Account Balance', 'route' => 'bank-accounts.balance'],
                ['label' => 'Bank Transaction', 'route' => 'bank-transfers.index'],
                ['label' => 'Aproved Transaction', 'route' => 'bank-transfers.approved'],
                ['label' => 'Transfor Balance /Branch Acc', 'route' => 'bank-transfers.to-branch'],
                ['label' => 'Transfor Balance /Salary advance & disbursement Acc', 'route' => 'bank-transfers.to-hq'],
                ['label' => 'Register Bank Expenses', 'route' => 'expense-types.bank'],
                ['label' => 'Request Expenses', 'route' => 'bank-expenses.index'],
                ['label' => 'Payrol', 'route' => 'payroll.index'],
            ]],
            ['label' => 'Salary Advance', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Salary advance Category', 'route' => 'salary-advance-categories.index'],
                ['label' => 'Salary Advance Request', 'route' => 'salary-advances.requested'],
                ['label' => 'Salary Advance Aproved', 'route' => 'salary-advances.approved'],
                ['label' => 'Active Salary Advance', 'route' => 'salary-advances.active'],
                ['label' => 'Salary advance Repayment', 'route' => 'salary-advances.repayments'],
                ['label' => 'Salary advance paid List', 'route' => 'salary-advances.paid'],
            ]],
            ['label' => 'Penarty', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Penarty List', 'route' => 'penalties.index'],
                ['label' => 'Paid Penarty', 'route' => 'penalties.paid'],
            ]],
            ['label' => 'Loan Fee', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Deducted Income', 'route' => 'loan-fees.income'],
            ]],
            ['label' => 'Expenses', 'icon' => 'icon-list', 'children' => [
                ['label' => 'Register Branch Expenses', 'route' => 'expense-types.branch'],
                ['label' => 'All Expenses Request', 'route' => 'expenses.requests'],
                ['label' => 'All Accept Expenses', 'route' => 'expenses.accepted'],
            ]],
            ['label' => 'Headquater Expenses', 'icon' => 'icon-list', 'children' => [
                ['label' => 'Register Expenses', 'route' => 'expense-types.hq'],
                ['label' => 'All Expenses Requested', 'route' => 'hq-expenses.requests'],
                ['label' => 'All Aproved Expenses', 'route' => 'hq-expenses.approved'],
            ]],
            ['label' => 'Headquater Transaction', 'icon' => 'icon-list', 'children' => [
                ['label' => 'Hq Account balance', 'route' => 'hq-transactions.balance'],
                ['label' => 'Requested Transaction', 'route' => 'hq-transactions.requests'],
                ['label' => 'Aproved Transaction', 'route' => 'hq-transactions.approved'],
            ]],
            ['label' => 'Customer', 'icon' => 'icon-user', 'children' => [
                ['label' => 'Register Customer', 'route' => 'customers.create', 'also' => ['customers.basic', 'customers.additional', 'customers.passport']],
                ['label' => 'All Customer', 'route' => 'customers.index', 'also' => ['customers.show', 'customers.monthly', 'customers.weekly', 'customers.daily']],
                ['label' => 'Customer profile', 'route' => 'customers.search'],
            ]],
            ['label' => 'Group', 'icon' => 'icon-people', 'children' => [
                ['label' => 'All groups', 'route' => 'groups.index'],
            ]],
            ['label' => 'Loan', 'icon' => 'icon-list', 'children' => [
                ['label' => 'Loan Application', 'route' => 'loans.application', 'also' => ['loans.start', 'loans.form', 'loans.securities']],
                ['label' => 'Loan Pending Approve', 'route' => 'loans.pending', 'also' => ['loans.show', 'loans.edit', 'loans.special']],
                ['label' => 'Loan Disbursed', 'route' => 'loans.disbursed'],
                ['label' => 'Loan Withdrawal', 'route' => 'loans.withdrawal'],
                ['label' => 'Loan Rejected', 'route' => 'loans.rejected'],
            ]],
            ['label' => 'Teller', 'icon' => 'icon-list', 'route' => 'teller.index', 'also' => ['teller.show']],
            ['label' => 'Agent', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Payment mode', 'route' => 'payment-modes.index'],
                ['label' => 'Record transaction', 'route' => 'agent-transactions.record'],
                ['label' => 'Deposit transaction', 'route' => 'agent-transactions.deposit'],
            ]],
            ['label' => 'Insurelance', 'icon' => 'icon-wallet', 'children' => [
                ['label' => 'Deposit & Withdrawal', 'route' => 'savings.search'],
                ['label' => 'Today Insurelance', 'route' => 'savings.deposits'],
                ['label' => 'Today withdrawal Insurelance', 'route' => 'savings.withdrawals'],
                ['label' => 'Insurelance Balance', 'route' => 'savings.balance'],
            ]],
            ['label' => 'VISA', 'icon' => 'icon-list', 'route' => 'visa.index'],
        ],
    ],

    'sub_menu' => [
        'label' => 'Report',
        'items' => [
            ['label' => 'Cash Transaction', 'icon' => 'icon-wallet', 'route' => 'reports.cash'],
            ['label' => 'Branch Wise Report', 'icon' => 'icon-list', 'route' => 'reports.branchwise'],
            ['label' => 'File', 'icon' => 'icon-list', 'route' => 'reports.file'],
            ['label' => 'Loan Pending', 'icon' => 'icon-list', 'route' => 'reports.pending'],
            ['label' => 'Loan Repayment', 'icon' => 'icon-list', 'route' => 'reports.repayment'],
            ['label' => 'Default Loan', 'icon' => 'icon-list', 'route' => 'reports.default'],
            ['label' => 'Wright-off Loan', 'icon' => 'icon-list', 'route' => 'reports.write-off'],
            ['label' => 'Loan Collection', 'icon' => 'icon-list', 'route' => 'reports.collection'],
            ['label' => 'Customer statement', 'icon' => 'icon-list', 'route' => 'reports.statement'],
            ['label' => 'Today Receivable', 'icon' => 'icon-list', 'route' => 'reports.receivable'],
            ['label' => 'Today Received', 'icon' => 'icon-list', 'route' => 'reports.received'],
            ['label' => 'Daily Report', 'icon' => 'icon-wallet', 'route' => 'reports.daily'],
            ['label' => 'Customer Development', 'icon' => 'icon-list', 'route' => 'reports.development'],
        ],
    ],

    'setting' => [
        'label' => 'HRM',
        'items' => [
            ['label' => 'All active staff', 'icon' => 'icon-list', 'route' => 'employees.index'],
            ['label' => 'All Rejected staff', 'icon' => 'icon-list', 'route' => 'employees.rejected'],
            ['label' => 'Branch &  Staff', 'icon' => 'icon-list', 'route' => 'employees.by-branch'],
            ['label' => 'Staff Leave', 'icon' => 'icon-list', 'route' => 'leaves.index'],
            ['label' => 'Staff Allowance', 'icon' => 'icon-wallet', 'route' => 'allowances.index'],
            ['label' => 'Staff Deduction', 'icon' => 'icon-list', 'route' => 'deductions.index'],
            ['label' => 'Salary Sheet', 'icon' => 'icon-list', 'route' => 'salary-sheet.index'],
            ['label' => 'Salary Advanced', 'icon' => 'icon-list', 'route' => 'staff-salary-advances.index'],
            ['label' => 'Staff Loan', 'icon' => 'icon-list', 'route' => 'staff-loans.index'],
            ['label' => 'Staff Loan category', 'icon' => 'icon-settings', 'route' => 'staff-loan-categories.index'],
            ['label' => 'Staff salary advance category', 'icon' => 'icon-settings', 'route' => 'staff-salary-advance-categories.index'],
        ],
    ],
];
