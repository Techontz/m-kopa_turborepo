/**
 * Finance (Head Office) top menu — the live MikopoFasta Finance header menu recreated on M-KOPA routes.
 *
 * Order and labels follow the live menu (Home, Branch, Customer, Individual Loan, Groups Loan, Hq Bank Balance, Salary Advance,
 * Staff Loan, Penalty, Hq Expenses, Branch Expenses, Report, HRM); live items without an M-KOPA equivalent are omitted and
 * M-KOPA features the live system lacks are placed in the most natural menu (Capital, Accounting, Insurance & Agent).
 * Every entry keeps the permission of the page it opens, so the menu is always filtered by the user's real permissions.
 */

export type Permission = string | string[];

export interface FinanceLink {
  label: string;
  href: string;
  permission?: Permission;
}

export interface FinanceMenuItem {
  label: string;
  /** Plain link (no dropdown). */
  href?: string;
  permission?: Permission;
  children?: FinanceLink[];
}

/** Role key whose users get the Head Office shell. */
export const FINANCE_ROLE_KEY = "finance";

export function usesFinanceShell(user: { role: { key: string } | null } | null | undefined): boolean {
  return user?.role?.key === FINANCE_ROLE_KEY;
}

const REPORTS = "reports.view";
const FINANCIAL = "reports.financial";

export const financeMenu: FinanceMenuItem[] = [
  { label: "Home", href: "/dashboard", permission: "dashboard.view" },
  {
    label: "Branch",
    children: [
      { label: "Branch Wise Report", href: "/reports/branchwise", permission: REPORTS },
      { label: "Branch Profit & Loss", href: "/reports/branch-pnl", permission: FINANCIAL },
      { label: "Branch Ranking", href: "/reports/branch-ranking", permission: FINANCIAL },
    ],
  },
  {
    label: "Customer",
    children: [
      { label: "Customer Profile", href: "/customers/search", permission: "customers.view" },
      { label: "All customer", href: "/customers", permission: "customers.view" },
      { label: "Register Customer", href: "/customers/register", permission: "customers.manage" },
    ],
  },
  {
    label: "Individual Loan",
    children: [
      { label: "Loan Application", href: "/loans/apply", permission: "loans.apply" },
      { label: "Loan request", href: "/loans/pending", permission: "loans.view" },
      { label: "Credit Review", href: "/loans/credit-review", permission: "loans.credit_review" },
      { label: "Disbursement", href: "/loans/disbursement", permission: ["loans.prepare_disbursement", "loans.disburse"] },
      { label: "Loan disbursed", href: "/loans/disbursed", permission: "loans.view" },
      { label: "Loan withdrawal", href: "/loans/withdrawal", permission: "loans.view" },
      { label: "Teller Dashboard", href: "/teller", permission: "payments.cash" },
      { label: "Default loan", href: "/reports/default", permission: REPORTS },
      { label: "Receivable", href: "/reports/receivable", permission: REPORTS },
      { label: "Received", href: "/reports/received", permission: REPORTS },
      { label: "Loan pending", href: "/reports/pending", permission: REPORTS },
      { label: "Penalty list", href: "/penalties", permission: "penalties.manage" },
      { label: "Loan Rejected", href: "/loans/rejected", permission: "loans.view" },
    ],
  },
  {
    label: "Groups Loan",
    children: [{ label: "Group List", href: "/groups", permission: ["groups.view", "groups.manage"] }],
  },
  {
    label: "Hq Bank Balance",
    children: [
      { label: "Account Balance", href: "/hq/balances", permission: "hq.manage" },
      { label: "Requested Transaction", href: "/hq/transactions", permission: "hq.manage" },
      { label: "From HQ Approved Transaction", href: "/hq/transactions/approved", permission: "hq.manage" },
      { label: "Received Transaction", href: "/bank/to-hq", permission: "bank.manage" },
      { label: "Bank Account Balance", href: "/bank/balances", permission: "bank.manage" },
      { label: "Register Account", href: "/bank/accounts", permission: "bank.manage" },
      { label: "Bank Transaction", href: "/bank/transfers", permission: "bank.manage" },
      { label: "Approved Bank Transaction", href: "/bank/transfers/approved", permission: "bank.manage" },
      { label: "Company Cash ↔ Bank Transfer", href: "/bank/company-transfers", permission: "bank.manage" },
      { label: "Send Reserve To Investment", href: "/bank/reserve-to-investment", permission: "bank.manage" },
      { label: "Send Petty Cash To Branch", href: "/bank/petty-cash", permission: "bank.manage" },
    ],
  },
  {
    label: "Salary Advance",
    children: [
      { label: "Requested", href: "/salary-advance/requested", permission: "salary_advance.manage" },
      { label: "Approved", href: "/salary-advance/approved", permission: "salary_advance.manage" },
      { label: "Active", href: "/salary-advance/active", permission: "salary_advance.manage" },
      { label: "Repayments", href: "/salary-advance/repayments", permission: "salary_advance.manage" },
      { label: "Salary Advance Paid List", href: "/salary-advance/paid", permission: "salary_advance.manage" },
      { label: "Salary Advance Category", href: "/salary-advance/categories", permission: "salary_advance.manage" },
    ],
  },
  {
    label: "Staff Loan",
    children: [
      { label: "Approved Loan", href: "/hrm/staff-loans", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Active Loan", href: "/hrm/staff-loans/active", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Staff Salary Advance", href: "/hrm/salary-advances", permission: ["hrm.manage", "payroll.pay"] },
    ],
  },
  {
    label: "Penalty",
    children: [
      { label: "Penalty List", href: "/penalties", permission: "penalties.manage" },
      { label: "Paid Penalty", href: "/penalties/paid", permission: "penalties.manage" },
    ],
  },
  {
    label: "Hq Expenses",
    children: [
      { label: "Request Expenses", href: "/hq-expenses/requests", permission: ["hq.manage", "expenses.approve_hq"] },
      { label: "Approved Expenses", href: "/hq-expenses/approved", permission: ["hq.manage", "expenses.approve_hq"] },
      { label: "Register Expenses", href: "/hq-expenses/types", permission: "hq.manage" },
      { label: "Register Bank Expenses", href: "/bank/expense-types", permission: "bank.manage" },
      { label: "Bank Expenses Request", href: "/bank/expenses", permission: "bank.manage" },
    ],
  },
  {
    label: "Branch Expenses",
    children: [
      { label: "Requested Expenses", href: "/expenses/requests", permission: ["expenses.request", "expenses.approve_branch", "expenses.approve_hq"] },
      { label: "Approved Expenses", href: "/expenses/accepted", permission: ["expenses.approve_branch", "expenses.approve_hq", FINANCIAL] },
      { label: "Register Branch Expenses", href: "/expenses/types", permission: ["expenses.request", "settings.manage"] },
    ],
  },
  {
    label: "Report",
    children: [
      { label: "Cash transaction", href: "/reports/cash", permission: REPORTS },
      { label: "Today Received", href: "/reports/received", permission: REPORTS },
      { label: "Saving Deposit Balance", href: "/savings/balances", permission: "savings.manage" },
      { label: "Customer Development", href: "/reports/development", permission: REPORTS },
      { label: "Loan Pending", href: "/reports/pending", permission: REPORTS },
      { label: "Default Loan", href: "/reports/default", permission: REPORTS },
      { label: "Customer Account statement", href: "/reports/statement", permission: REPORTS },
      { label: "Loan Fee Income", href: "/loan-fees/income", permission: "income.view" },
      { label: "Daily Report", href: "/reports/daily", permission: REPORTS },
      { label: "File", href: "/reports/file", permission: REPORTS },
      { label: "Loan Repayment", href: "/reports/repayment", permission: REPORTS },
      { label: "Write-off Loan", href: "/reports/write-off", permission: REPORTS },
      { label: "Loan Collection", href: "/reports/collection", permission: REPORTS },
      { label: "Loan Portfolio", href: "/reports/portfolio", permission: REPORTS },
      { label: "Repayment (Expected vs Actual)", href: "/reports/collections", permission: REPORTS },
      { label: "Arrears & PAR", href: "/reports/arrears", permission: REPORTS },
      { label: "Recovery", href: "/reports/recovery", permission: REPORTS },
      { label: "Repayment Behaviour (DPD)", href: "/reports/behaviour", permission: REPORTS },
      { label: "Customer Segmentation", href: "/reports/segmentation", permission: REPORTS },
      { label: "Age Analysis", href: "/reports/age-analysis", permission: REPORTS },
    ],
  },
  {
    label: "HRM",
    children: [
      { label: "Active Staff", href: "/hrm/staff", permission: ["hrm.manage", "users.manage"] },
      { label: "Rejected Staff", href: "/hrm/staff/rejected", permission: ["hrm.manage", "users.manage"] },
      { label: "Branch & Staff", href: "/hrm/branches", permission: ["hrm.manage", "users.manage"] },
      { label: "Staff Leave", href: "/hrm/leave", permission: "hrm.manage" },
      { label: "Attendance", href: "/hrm/attendance", permission: "hrm.manage" },
      { label: "Staff Allowance", href: "/hrm/allowances", permission: "hrm.manage" },
      { label: "Staff Deduction", href: "/hrm/deductions", permission: "hrm.manage" },
      { label: "Salary Sheet", href: "/hrm/salary-sheet", permission: ["payroll.approve", "payroll.pay"] },
      { label: "Payroll", href: "/bank/payroll", permission: ["bank.manage", "payroll.pay"] },
      { label: "Commission", href: "/hrm/commission", permission: ["payroll.approve", FINANCIAL] },
      { label: "Staff Fund", href: "/hrm/staff-fund", permission: ["hrm.manage", "payroll.pay"] },
      { label: "Performance", href: "/hrm/performance", permission: "hrm.manage" },
      { label: "Staff Loan Category", href: "/hrm/staff-loan-categories", permission: "hrm.manage" },
      { label: "Staff Salary Advance Category", href: "/hrm/staff-salary-advance-categories", permission: "hrm.manage" },
    ],
  },
  {
    label: "Capital",
    children: [
      { label: "Shareholders", href: "/capital/share-holders", permission: "capital.view" },
      { label: "Add Capitals", href: "/capital/capitals", permission: "capital.view" },
      { label: "Assets", href: "/capital/assets", permission: ["capital.view", "capital.manage"] },
      { label: "Dividends", href: "/capital/dividends", permission: "capital.manage" },
      { label: "Shares", href: "/shares", permission: "shares.view" },
      { label: "Float", href: "/capital/floats", permission: "float.manage" },
      { label: "Float Branch To Branch", href: "/capital/floats/branch", permission: "float.manage" },
      { label: "Approved Float", href: "/capital/floats/approved", permission: "float.manage" },
      { label: "Float Ac-Ac", href: "/capital/floats/accounts", permission: "float.manage" },
      { label: "Dividend Settings", href: "/settings/dividends", permission: "settings.manage" },
    ],
  },
  {
    label: "Accounting",
    children: [
      { label: "Chart of Accounts", href: "/accounting/accounts", permission: "accounting.view" },
      { label: "Journal Entries", href: "/accounting/journal", permission: "accounting.view" },
      { label: "Month End & Profit", href: "/accounting/period-close", permission: "accounting.close_period" },
      { label: "Audit Trail", href: "/accounting/audit", permission: "audit.view" },
      { label: "Cash Verification", href: "/payments/cash-verification", permission: "payments.verify" },
      { label: "Bank Reconciliation", href: "/payments/reconciliation", permission: "payments.verify" },
      { label: "Suspense Account", href: "/payments/suspense", permission: "payments.suspense" },
      { label: "Master Cash Flow", href: "/reports/cash-flow", permission: FINANCIAL },
      { label: "Expense Report", href: "/reports/expenses", permission: FINANCIAL },
      { label: "HQ 2% Hold", href: "/reports/hq-hold", permission: FINANCIAL },
      { label: "Loss Carry Forward", href: "/reports/loss-carry-forward", permission: FINANCIAL },
      { label: "Consolidated P&L", href: "/reports/profit-loss", permission: FINANCIAL },
      { label: "Balance Sheet", href: "/reports/balance-sheet", permission: FINANCIAL },
      { label: "Cash & Fund Position", href: "/reports/fund-position", permission: FINANCIAL },
      { label: "Suspense Report", href: "/reports/suspense", permission: FINANCIAL },
      { label: "Reversal Report", href: "/reports/reversals", permission: FINANCIAL },
      { label: "Daily Position", href: "/reports/daily-position", permission: FINANCIAL },
      { label: "Pending Approvals", href: "/approvals", permission: "approvals.view" },
    ],
  },
  {
    label: "Insurance & Agent",
    children: [
      { label: "Deposit & Withdrawal", href: "/savings", permission: "savings.manage" },
      { label: "Today Insurance", href: "/savings/deposits", permission: "savings.manage" },
      { label: "Today withdrawal Insurance", href: "/savings/withdrawals", permission: "savings.manage" },
      { label: "Agent Payment mode", href: "/agent/payment-modes", permission: "agent.manage" },
      { label: "Agent Record transaction", href: "/agent/transactions", permission: "agent.manage" },
      { label: "Agent Deposit transaction", href: "/agent/deposits", permission: "agent.manage" },
      { label: "VISA", href: "/visa", permission: "visa.manage" },
    ],
  },
  {
    label: "Settings",
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
      { label: "Approval Policy", href: "/settings/approval-policy", permission: "settings.manage" },
      { label: "Roles & Permissions", href: "/settings/roles", permission: "users.manage" },
    ],
  },
];

/** Links shown in the user dropdown (name on the bar), after the role/branch line. */
export const financeUserLinks: FinanceLink[] = [
  { label: "Messages", href: "/messages", permission: "messages.use" },
  { label: "My Shareholder Portal", href: "/shareholder", permission: "shareholder.portal" },
  { label: "Goals", href: "/goals", permission: ["goals.view", "goals.manage"] },
  { label: "CRM", href: "/crm", permission: "crm.use" },
];

type Can = (permission: Permission) => boolean;

const allowed = (entry: { permission?: Permission }, can: Can) => !entry.permission || can(entry.permission);

/** Removes entries the user may not open; a dropdown with no visible children disappears. */
export function visibleFinanceMenu(menu: FinanceMenuItem[], can: Can): FinanceMenuItem[] {
  return menu
    .map((item) => (item.children ? { ...item, children: item.children.filter((child) => allowed(child, can)) } : item))
    .filter((item) => allowed(item, can) && (!item.children || item.children.length > 0));
}

export function visibleUserLinks(can: Can): FinanceLink[] {
  return financeUserLinks.filter((link) => allowed(link, can));
}

export function isActiveHref(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

/**
 * The top item to highlight for a path: an exact child match wins over a prefix match (e.g. /hq/transactions/approved
 * belongs to its own entry, not to /hq/transactions), and the first menu containing the page wins for shared pages.
 */
export function activeFinanceItem(menu: FinanceMenuItem[], pathname: string): string | null {
  for (const item of menu) {
    if (item.href && isActiveHref(pathname, item.href)) {
      return item.label;
    }
  }
  for (const exact of [true, false]) {
    for (const item of menu) {
      if (item.children?.some((child) => (exact ? pathname === child.href : isActiveHref(pathname, child.href)))) {
        return item.label;
      }
    }
  }
  return null;
}

/** The single child link to mark as current inside the open dropdown (longest matching href). */
export function activeFinanceHref(menu: FinanceMenuItem[], pathname: string): string | null {
  const hrefs = menu.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]).filter((href): href is string => !!href);
  const matches = hrefs.filter((href) => isActiveHref(pathname, href)).sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}
