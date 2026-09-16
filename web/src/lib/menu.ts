/**
 * Sidebar navigation. Mirrors the live system's three tabs (Menu / Report / HRM) and labels,
 * extended with the modules required by the Documents (payments, accounting, CRM, messages, goals).
 */

export interface MenuLink {
  label: string;
  href: string;
  permission?: string | string[];
}

export interface MenuItem {
  label: string;
  icon: string;
  href?: string;
  permission?: string | string[];
  children?: MenuLink[];
}

export interface MenuTab {
  key: string;
  label: string;
  items: MenuItem[];
}

export const menu: MenuTab[] = [
  {
    key: "menu",
    label: "Menu",
    items: [
      { label: "Dashboard", icon: "icon-home", href: "/dashboard", permission: "dashboard.view" },
      { label: "Pending Approvals", icon: "icon-check", href: "/approvals", permission: "approvals.view" },
      {
        label: "Settings",
        icon: "icon-settings",
        children: [
          { label: "Customer Types", href: "/settings/customer-types", permission: "settings.manage" },
          { label: "Branch", href: "/settings/branches", permission: "settings.manage" },
          { label: "Zones", href: "/settings/zones", permission: "settings.manage" },
          { label: "Interest Formula", href: "/settings/formulas", permission: "settings.manage" },
          { label: "Loan Categories", href: "/settings/loan-categories", permission: "settings.manage" },
          { label: "Master Data", href: "/settings/master-data", permission: "settings.manage" },
          { label: "Geography", href: "/settings/geography", permission: "settings.manage" },
          { label: "Loan Fee", href: "/settings/loan-fees", permission: "settings.manage" },
          { label: "Penalty", href: "/settings/penalty", permission: "settings.manage" },
          { label: "Reserve Setting", href: "/settings/reserve", permission: "settings.manage" },
          { label: "Dividend Settings", href: "/settings/dividends", permission: "settings.manage" },
          { label: "Approval Policy", href: "/settings/approval-policy", permission: "settings.manage" },
          { label: "Roles & Permissions", href: "/settings/roles", permission: "users.manage" },
        ],
      },
      {
        label: "Capital",
        icon: "icon-wallet",
        children: [
          { label: "Shareholders", href: "/capital/share-holders", permission: "capital.view" },
          { label: "Add Capitals", href: "/capital/capitals", permission: "capital.view" },
          { label: "Assets", href: "/capital/assets", permission: ["capital.view", "capital.manage"] },
          { label: "Dividends", href: "/capital/dividends", permission: "capital.manage" },
          { label: "Shares", href: "/shares", permission: "shares.view" },
          { label: "Float", href: "/capital/floats", permission: "float.manage" },
          { label: "Approved Float", href: "/capital/floats/approved", permission: "float.manage" },
        ],
      },
      {
        label: "Bank",
        icon: "icon-wallet",
        children: [
          { label: "Register Account", href: "/bank/accounts", permission: "bank.manage" },
          { label: "Account Balance", href: "/bank/balances", permission: "bank.manage" },
          { label: "Bank Transaction", href: "/bank/transfers", permission: "bank.manage" },
          { label: "Approved Transaction", href: "/bank/transfers/approved", permission: "bank.manage" },
          { label: "Transfer Balance /Salary advance & disbursement Acc", href: "/bank/to-hq", permission: "bank.manage" },
          { label: "Company Cash ↔ Bank Transfer", href: "/bank/company-transfers", permission: "bank.manage" },
          { label: "Send Reserve To Investment", href: "/bank/reserve-to-investment", permission: "bank.manage" },
          { label: "Send Petty Cash To Branch", href: "/bank/petty-cash", permission: "bank.manage" },
          { label: "Register Bank Expenses", href: "/bank/expense-types", permission: "bank.manage" },
          { label: "Request Expenses", href: "/bank/expenses", permission: "bank.manage" },
          { label: "Payroll", href: "/bank/payroll", permission: ["bank.manage", "payroll.pay"] },
        ],
      },
      {
        label: "Salary Advance",
        icon: "icon-wallet",
        children: [
          { label: "Salary advance Category", href: "/salary-advance/categories", permission: "salary_advance.manage" },
          { label: "Salary Advance Request", href: "/salary-advance/requested", permission: "salary_advance.manage" },
          { label: "Salary Advance Approved", href: "/salary-advance/approved", permission: "salary_advance.manage" },
          { label: "Active Salary Advance", href: "/salary-advance/active", permission: "salary_advance.manage" },
          { label: "Salary advance Repayment", href: "/salary-advance/repayments", permission: "salary_advance.manage" },
          { label: "Salary advance paid List", href: "/salary-advance/paid", permission: "salary_advance.manage" },
        ],
      },
      {
        label: "Penalty",
        icon: "icon-wallet",
        children: [
          { label: "Penalty List", href: "/penalties", permission: "penalties.manage" },
          { label: "Paid Penalty", href: "/penalties/paid", permission: "penalties.manage" },
        ],
      },
      {
        label: "Loan Fee",
        icon: "icon-wallet",
        children: [{ label: "Deducted Income", href: "/loan-fees/income", permission: "income.view" }],
      },
      {
        label: "Expenses",
        icon: "icon-list",
        children: [
          { label: "Register Branch Expenses", href: "/expenses/types", permission: ["expenses.request", "settings.manage"] },
          { label: "All Expenses Request", href: "/expenses/requests", permission: ["expenses.request", "expenses.approve_branch", "expenses.approve_hq"] },
          { label: "All Accept Expenses", href: "/expenses/accepted", permission: ["expenses.approve_branch", "expenses.approve_hq", "reports.financial"] },
        ],
      },
      {
        label: "Headquarters Expenses",
        icon: "icon-list",
        children: [
          { label: "Register Expenses", href: "/hq-expenses/types", permission: "hq.manage" },
          { label: "All Expenses Requested", href: "/hq-expenses/requests", permission: ["hq.manage", "expenses.approve_hq"] },
          { label: "All Approved Expenses", href: "/hq-expenses/approved", permission: ["hq.manage", "expenses.approve_hq"] },
        ],
      },
      {
        label: "Headquarters Transaction",
        icon: "icon-list",
        children: [
          { label: "Hq Account balance", href: "/hq/balances", permission: "hq.manage" },
          { label: "Requested Transaction", href: "/hq/transactions", permission: "hq.manage" },
          { label: "Approved Transaction", href: "/hq/transactions/approved", permission: "hq.manage" },
        ],
      },
      {
        label: "Customer",
        icon: "icon-user",
        children: [
          { label: "Register Customer", href: "/customers/register", permission: "customers.manage" },
          { label: "All Customer", href: "/customers", permission: "customers.view" },
          { label: "Customer Profile", href: "/customers/search", permission: "customers.view" },
        ],
      },
      {
        label: "Group",
        icon: "icon-people",
        children: [{ label: "All groups", href: "/groups", permission: ["groups.view", "groups.manage"] }],
      },
      {
        label: "Loan",
        icon: "icon-list",
        children: [
          { label: "Loan Application", href: "/loans/apply", permission: "loans.apply" },
          { label: "Loan Pending Approve", href: "/loans/pending", permission: ["loans.view"] },
          { label: "Credit Review", href: "/loans/credit-review", permission: "loans.credit_review" },
          { label: "Credit Assessment", href: "/loans/credit-assessments", permission: ["loans.credit_review", "loans.approve_manager"] },
          { label: "Disbursement", href: "/loans/disbursement", permission: ["loans.prepare_disbursement", "loans.disburse"] },
          { label: "Loan Disbursed", href: "/loans/disbursed", permission: "loans.view" },
          { label: "Loan Withdrawal", href: "/loans/withdrawal", permission: "loans.view" },
          { label: "Loan Rejected", href: "/loans/rejected", permission: "loans.view" },
        ],
      },
      { label: "Teller", icon: "icon-list", href: "/teller", permission: "payments.cash" },
      {
        label: "Payments",
        icon: "icon-credit-card",
        children: [
          { label: "Cash Verification", href: "/payments/cash-verification", permission: "payments.verify" },
          { label: "Bank Reconciliation", href: "/payments/reconciliation", permission: "payments.verify" },
          { label: "Suspense Account", href: "/payments/suspense", permission: "payments.suspense" },
        ],
      },
      {
        label: "Accounting",
        icon: "icon-calculator",
        children: [
          { label: "Chart of Accounts", href: "/accounting/accounts", permission: "accounting.view" },
          { label: "Journal Entries", href: "/accounting/journal", permission: "accounting.view" },
          { label: "Month End & Profit", href: "/accounting/period-close", permission: "accounting.close_period" },
          { label: "Audit Trail", href: "/accounting/audit", permission: "audit.view" },
        ],
      },
      {
        label: "Agent",
        icon: "icon-wallet",
        children: [
          { label: "Payment mode", href: "/agent/payment-modes", permission: "agent.manage" },
          { label: "Record transaction", href: "/agent/transactions", permission: "agent.manage" },
          { label: "Deposit transaction", href: "/agent/deposits", permission: "agent.manage" },
        ],
      },
      {
        label: "Insurance",
        icon: "icon-wallet",
        children: [
          { label: "Deposit & Withdrawal", href: "/savings", permission: "savings.manage" },
          { label: "Today Insurance", href: "/savings/deposits", permission: "savings.manage" },
          { label: "Today withdrawal Insurance", href: "/savings/withdrawals", permission: "savings.manage" },
          { label: "Insurance Balance", href: "/savings/balances", permission: "savings.manage" },
        ],
      },
      { label: "VISA", icon: "icon-list", href: "/visa", permission: "visa.manage" },
      { label: "CRM", icon: "icon-call-in", href: "/crm", permission: "crm.use" },
      { label: "Messages", icon: "icon-bubbles", href: "/messages", permission: "messages.use" },
      { label: "Goals", icon: "icon-target", href: "/goals", permission: ["goals.view", "goals.manage"] },
      { label: "My Shareholder Portal", icon: "icon-pie-chart", href: "/shareholder", permission: "shareholder.portal" },
    ],
  },
  {
    key: "sub_menu",
    label: "Report",
    items: [
      { label: "Cash Transaction", icon: "icon-wallet", href: "/reports/cash", permission: "reports.view" },
      { label: "Branch Wise Report", icon: "icon-list", href: "/reports/branchwise", permission: "reports.view" },
      { label: "File", icon: "icon-list", href: "/reports/file", permission: "reports.view" },
      { label: "Loan Pending", icon: "icon-list", href: "/reports/pending", permission: "reports.view" },
      { label: "Loan Repayment", icon: "icon-list", href: "/reports/repayment", permission: "reports.view" },
      { label: "Default Loan", icon: "icon-list", href: "/reports/default", permission: "reports.view" },
      { label: "Write-off Loan", icon: "icon-list", href: "/reports/write-off", permission: "reports.view" },
      { label: "Loan Collection", icon: "icon-list", href: "/reports/collection", permission: "reports.view" },
      { label: "Customer statement", icon: "icon-list", href: "/reports/statement", permission: "reports.view" },
      { label: "Today Receivable", icon: "icon-list", href: "/reports/receivable", permission: "reports.view" },
      { label: "Today Received", icon: "icon-list", href: "/reports/received", permission: "reports.view" },
      { label: "Daily Report", icon: "icon-wallet", href: "/reports/daily", permission: "reports.view" },
      { label: "Customer Development", icon: "icon-list", href: "/reports/development", permission: "reports.view" },
      {
        label: "Portfolio & Risk",
        icon: "icon-pie-chart",
        permission: "reports.view",
        children: [
          { label: "Loan Portfolio", href: "/reports/portfolio", permission: "reports.view" },
          { label: "Repayment (Expected vs Actual)", href: "/reports/collections", permission: "reports.view" },
          { label: "Arrears & PAR", href: "/reports/arrears", permission: "reports.view" },
          { label: "Recovery", href: "/reports/recovery", permission: "reports.view" },
          { label: "Repayment Behaviour (DPD)", href: "/reports/behaviour", permission: "reports.view" },
          { label: "Customer Segmentation", href: "/reports/segmentation", permission: "reports.view" },
          { label: "Age Analysis", href: "/reports/age-analysis", permission: "reports.view" },
        ],
      },
      {
        label: "Financial",
        icon: "icon-graph",
        permission: "reports.financial",
        children: [
          { label: "Master Cash Flow", href: "/reports/cash-flow", permission: "reports.financial" },
          { label: "Branch Profit & Loss", href: "/reports/branch-pnl", permission: "reports.financial" },
          { label: "Branch Ranking", href: "/reports/branch-ranking", permission: "reports.financial" },
          { label: "Expense Report", href: "/reports/expenses", permission: "reports.financial" },
          { label: "HQ 2% Hold", href: "/reports/hq-hold", permission: "reports.financial" },
          { label: "Loss Carry Forward", href: "/reports/loss-carry-forward", permission: "reports.financial" },
          { label: "Consolidated P&L", href: "/reports/profit-loss", permission: "reports.financial" },
          { label: "Balance Sheet", href: "/reports/balance-sheet", permission: "reports.financial" },
          { label: "Cash & Fund Position", href: "/reports/fund-position", permission: "reports.financial" },
          { label: "Suspense Report", href: "/reports/suspense", permission: "reports.financial" },
          { label: "Reversal Report", href: "/reports/reversals", permission: "reports.financial" },
          { label: "Daily Position", href: "/reports/daily-position", permission: "reports.financial" },
        ],
      },
    ],
  },
  {
    key: "setting",
    label: "HRM",
    items: [
      { label: "All active staff", icon: "icon-list", href: "/hrm/staff", permission: ["hrm.manage", "users.manage"] },
      { label: "All Rejected staff", icon: "icon-list", href: "/hrm/staff/rejected", permission: ["hrm.manage", "users.manage"] },
      { label: "Branch &  Staff", icon: "icon-list", href: "/hrm/branches", permission: ["hrm.manage", "users.manage"] },
      { label: "Staff Leave", icon: "icon-list", href: "/hrm/leave", permission: "hrm.manage" },
      { label: "Attendance", icon: "icon-clock", href: "/hrm/attendance", permission: "hrm.manage" },
      { label: "Staff Allowance", icon: "icon-wallet", href: "/hrm/allowances", permission: "hrm.manage" },
      { label: "Staff Deduction", icon: "icon-list", href: "/hrm/deductions", permission: "hrm.manage" },
      { label: "Salary Sheet", icon: "icon-list", href: "/hrm/salary-sheet", permission: ["payroll.approve", "payroll.pay"] },
      { label: "Commission", icon: "icon-trophy", href: "/hrm/commission", permission: ["payroll.approve", "reports.financial"] },
      { label: "Staff Fund", icon: "icon-drawer", href: "/hrm/staff-fund", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Salary Advance", icon: "icon-list", href: "/hrm/salary-advances", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Staff Loan", icon: "icon-list", href: "/hrm/staff-loans", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Active Staff Loan", icon: "icon-list", href: "/hrm/staff-loans/active", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Performance", icon: "icon-speedometer", href: "/hrm/performance", permission: "hrm.manage" },
      { label: "Staff Loan category", icon: "icon-settings", href: "/hrm/staff-loan-categories", permission: "hrm.manage" },
      { label: "Staff salary advance category", icon: "icon-settings", href: "/hrm/staff-salary-advance-categories", permission: "hrm.manage" },
    ],
  },
];
