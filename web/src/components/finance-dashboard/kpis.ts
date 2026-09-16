/**
 * Finance (Head Office) dashboard display mapping. Every figure, total and percentage is computed by the API
 * (GET dashboard → `finance_kpis`, `today`, `cards`); these helpers only pick values for display.
 */

export interface ProgressKpi {
  collected: number;
  due: number;
  /** Server-rounded to two decimals, as the live "23.16%". */
  percent: number;
}

export interface FinanceKpis {
  penalty: (ProgressKpi & { remaining: number }) | null;
  salary_advance: {
    received: ProgressKpi;
    default: ProgressKpi & { unpaid: number; count: number };
    customers: { active: number; new: number; old: number };
  } | null;
  hq_accounts: { rows: HqBalanceRow[]; total: number } | null;
  company_accounts: { rows: Array<{ name: string; balance: number }>; total: number } | null;
  account_balance: { label: string; amount: number } | null;
}

export interface DashboardPayload {
  header_accounts: Record<string, number> | null;
  cards: { account_balance: number; loan_withdrawal: number; receivable: number; default_loan: number };
  branch_accounts: Array<Record<string, number | string>> | null;
  today: Record<string, number>;
  finance_kpis?: FinanceKpis;
}

export interface HqBalanceRow {
  account: string;
  name: string;
  balance: number;
}

export interface StaffRequests {
  pending: unknown[];
}

export interface CollectionRow {
  label: string;
  expected: number;
  collected: number;
}

const EMPTY_PROGRESS: ProgressKpi = { collected: 0, due: 0, percent: 0 };

const num = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const progress = (kpi: Partial<ProgressKpi> | null | undefined): ProgressKpi =>
  kpi ? { collected: num(kpi.collected), due: num(kpi.due), percent: num(kpi.percent) } : EMPTY_PROGRESS;

/** Bar width in %, clamped to 0–100. */
export function barWidth(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

/** The three progress bars (Penalty / Salary Advance Receivable-Received / Default Salary Advance), as the API computed them. */
export function progressKpis(kpis: FinanceKpis | undefined): { penalty: ProgressKpi; received: ProgressKpi; defaulted: ProgressKpi } {
  return {
    penalty: progress(kpis?.penalty),
    received: progress(kpis?.salary_advance?.received),
    defaulted: progress(kpis?.salary_advance?.default),
  };
}

/** "Salary Advance customer": Active / New / Old counted by the API. */
export function salaryAdvanceCustomers(kpis: FinanceKpis | undefined): { active: number; fresh: number; old: number } {
  const customers = kpis?.salary_advance?.customers;
  return { active: num(customers?.active), fresh: num(customers?.new), old: num(customers?.old) };
}

/** "Requested salary advance / Loan": pending customer advances, staff advances and staff loans; the badge is their sum. */
export function requestedCounts(customer: unknown[] | undefined, staffAdvances: StaffRequests | undefined, staffLoans: StaffRequests | undefined) {
  const counts = { customer: customer?.length ?? 0, staffAdvance: staffAdvances?.pending?.length ?? 0, staffLoan: staffLoans?.pending?.length ?? 0 };
  return { ...counts, total: counts.customer + counts.staffAdvance + counts.staffLoan };
}

/** Header "Account Balance N TZS": the API total (HQ accounts for HQ users, else Company A/C + banks + reserve + assets); null while unavailable. */
export function accountBalance(dashboard: DashboardPayload | undefined): { label: string; amount: number } | null {
  const balance = dashboard?.finance_kpis?.account_balance;
  return balance ? { label: balance.label, amount: num(balance.amount) } : null;
}

/** "All income" box: Interest / Penalty / Loan Fee ledger balances. */
export function allIncome(dashboard: DashboardPayload | undefined): { interest: number; penalty: number; loanFee: number } | null {
  const accounts = dashboard?.header_accounts;
  if (!accounts) {
    return null;
  }
  return { interest: num(accounts["Interest A/c"]), penalty: num(accounts["Penalty A/c"]), loanFee: num(accounts["Loan Fee A/c"]) };
}

export interface Tile {
  key: string;
  label: string;
  icon: string;
  href: string;
  lines: string[];
}

/** The eight icon tiles, in live order. Values come from the dashboard payload and today's receivable / received reports. */
export function tileValues(
  dashboard: DashboardPayload | undefined,
  receivableTotal: number | undefined,
  receivedTotal: number | undefined,
  format: (value: number) => string,
): Array<Omit<Tile, "icon" | "href">> {
  const today = dashboard?.today;
  const tiles: Array<Omit<Tile, "icon" | "href"> | null> = [
    today ? { key: "penalty", label: "Today Penalty", lines: [format(num(today.penalty_income))] } : null,
    today ? { key: "loan_fee", label: "Today Loan Fee", lines: [format(num(today.loan_fee_income))] } : null,
    today ? { key: "insurance", label: "Insurance", lines: [`${format(num(today.insurance_income))} - Deposit`, `${format(num(today.saving_withdrawal))} - Withdrawal`] } : null,
    today ? { key: "agent", label: "Agent", lines: [format(num(today.agent_deposit))] } : null,
    today ? { key: "expenses", label: "Approved Expenses", lines: [format(num(today.expenses))] } : null,
    dashboard ? { key: "withdrawal", label: "Loan Withdrawal", lines: [format(num(dashboard.cards.loan_withdrawal))] } : null,
    receivableTotal !== undefined ? { key: "receivable", label: "Today Receivable", lines: [format(receivableTotal)] } : null,
    receivedTotal !== undefined ? { key: "received", label: "Today Received", lines: [format(receivedTotal)] } : null,
  ];
  return tiles.filter((tile): tile is Omit<Tile, "icon" | "href"> => tile !== null);
}

/** Chart series for "Collections Statistics" (replaces live "Visitors Statistics", which M-KOPA has no data for). */
export function collectionsSeries(rows: CollectionRow[] | undefined): Array<{ label: string; expected: number; collected: number }> {
  return (rows ?? []).map((row) => ({ label: row.label, expected: num(row.expected), collected: num(row.collected) }));
}
