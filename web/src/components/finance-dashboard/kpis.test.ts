import { describe, expect, it } from "vitest";

import { money } from "@/lib/format";

import {
  accountBalance,
  allIncome,
  barWidth,
  collectionsSeries,
  progressKpis,
  requestedCounts,
  salaryAdvanceCustomers,
  tileValues,
  type DashboardPayload,
  type FinanceKpis,
} from "./kpis";

/** finance_kpis as returned by GET dashboard for the Finance user (figures computed on the server). */
const financeKpis: FinanceKpis = {
  penalty: { collected: 10000, remaining: 66500, due: 76500, percent: 13.07 },
  salary_advance: {
    received: { collected: 42000, due: 54000, percent: 77.78 },
    default: { collected: 4000, due: 18000, unpaid: 14000, percent: 77.78, count: 1 },
    customers: { active: 3, new: 2, old: 1 },
  },
  hq_accounts: { rows: [{ account: "hq_salary_advance", name: "SALARY ADVANCE ACCOUNT", balance: 500000 }, { account: "hq_interest", name: "INTEREST ACCOUNT", balance: 2500 }], total: 502500 },
  company_accounts: null,
  account_balance: { label: "HQ accounts", amount: 502500 },
};

/** Shapes captured from the local API as the Finance user (GET dashboard, reports/*). */
const dashboard: DashboardPayload = {
  header_accounts: { "Loan Fee A/c": 315000, "Penalty A/c": 0, "Interest A/c": 72000, "Reserve A/c": 18000 },
  cards: { account_balance: 71354999.99, loan_withdrawal: 120000, receivable: 795000, default_loan: 1314000 },
  branch_accounts: [{ name: "Head office", principal: 6664999.99, interest: 0, loan_fee: 15000, penalty: 0, reserve: 0, agent: 50000, insurance: 0 }],
  today: {
    penalty_income: 2500, loan_fee_income: 15000, insurance_income: 4000, saving_withdrawal: 1000, agent_deposit: 50000, expenses: 30000,
  },
  finance_kpis: financeKpis,
};

describe("finance dashboard KPI mapping", () => {
  it("clamps bar widths", () => {
    expect(barWidth(140)).toBe(100);
    expect(barWidth(-3)).toBe(0);
    expect(barWidth(23.16)).toBe(23.16);
  });

  it("shows the server-computed penalty and salary advance progress figures unchanged", () => {
    expect(progressKpis(financeKpis)).toEqual({
      penalty: { collected: 10000, due: 76500, percent: 13.07 },
      received: { collected: 42000, due: 54000, percent: 77.78 },
      defaulted: { collected: 4000, due: 18000, percent: 77.78 },
    });
  });

  it("shows zeros when a KPI block is not available to the user", () => {
    const empty = { collected: 0, due: 0, percent: 0 };
    expect(progressKpis(undefined)).toEqual({ penalty: empty, received: empty, defaulted: empty });
    expect(progressKpis({ ...financeKpis, penalty: null, salary_advance: null }).penalty).toEqual(empty);
  });

  it("Salary Advance customer box shows the API Active / New / Old counts", () => {
    expect(salaryAdvanceCustomers(financeKpis)).toEqual({ active: 3, fresh: 2, old: 1 });
    expect(salaryAdvanceCustomers(undefined)).toEqual({ active: 0, fresh: 0, old: 0 });
  });

  it("Requested salary advance / Loan badge sums customer advances, staff advances and staff loans", () => {
    expect(requestedCounts([{}, {}], { pending: [{}] }, { pending: [] })).toEqual({ customer: 2, staffAdvance: 1, staffLoan: 0, total: 3 });
    expect(requestedCounts([{}], undefined, undefined)).toEqual({ customer: 1, staffAdvance: 0, staffLoan: 0, total: 1 });
  });

  it("Account Balance is the API total and label; nothing is summed in the browser", () => {
    expect(accountBalance(dashboard)).toEqual({ label: "HQ accounts", amount: 502500 });
    expect(accountBalance({ ...dashboard, finance_kpis: undefined })).toBeNull();
    expect(accountBalance(undefined)).toBeNull();
  });

  it("All income reads the ledger balances; no header accounts means no box", () => {
    expect(allIncome(dashboard)).toEqual({ interest: 72000, penalty: 0, loanFee: 315000 });
    expect(allIncome({ ...dashboard, header_accounts: null })).toBeNull();
  });

  it("builds the eight tiles in live order from real figures only", () => {
    const tiles = tileValues(dashboard, 795000, 0, money);
    expect(tiles.map((tile) => tile.label)).toEqual(["Today Penalty", "Today Loan Fee", "Insurance", "Agent", "Approved Expenses", "Loan Withdrawal", "Today Receivable", "Today Received"]);
    expect(tiles.map((tile) => tile.lines)).toEqual([["2,500"], ["15,000"], ["4,000 - Deposit", "1,000 - Withdrawal"], ["50,000"], ["30,000"], ["120,000"], ["795,000"], ["0"]]);
  });

  it("omits tiles whose source is unavailable instead of inventing values", () => {
    expect(tileValues(undefined, undefined, undefined, money)).toEqual([]);
    expect(tileValues(undefined, 795000, undefined, money).map((tile) => tile.key)).toEqual(["receivable"]);
  });

  it("maps collection rows to the chart series", () => {
    expect(collectionsSeries([{ label: "2026-09-07", expected: 795000, collected: 0 }])).toEqual([{ label: "2026-09-07", expected: 795000, collected: 0 }]);
    expect(collectionsSeries(undefined)).toEqual([]);
  });
});
