import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { menu } from "./menu";
import { activeFinanceHref, activeFinanceItem, financeMenu, financeUserLinks, usesFinanceShell, visibleFinanceMenu, type Permission } from "./financeMenu";

/** Role `finance` default permissions (config/permissions.php, as returned by /auth/me for demo 0700000002). */
const FINANCE_PERMISSIONS = [
  "dashboard.view", "float.manage", "bank.manage", "expenses.approve_branch", "hq.manage", "customers.view", "groups.view", "branches.view_all",
  "loans.view", "loans.prepare_disbursement", "loans.disburse", "payments.verify", "payments.suspense", "accounting.view", "accounting.reverse",
  "accounting.close_period", "salary_advance.manage", "penalties.manage", "agent.manage", "savings.manage", "payroll.pay", "reports.view",
  "reports.financial", "income.view", "messages.use", "goals.view", "approvals.view",
];

const normalise = (permission: Permission | undefined) => (permission === undefined ? [] : [permission].flat().sort());

const canWith = (granted: string[]) => (permission: Permission) => (Array.isArray(permission) ? permission : [permission]).some((item) => granted.includes(item));

const APP_DIR = path.resolve(__dirname, "../app/(app)");

/** True when a static href resolves to an app route file (page.tsx), allowing dynamic segments. */
function routeExists(href: string): boolean {
  const segments = href.split("?")[0].split("/").filter(Boolean);
  const walk = (dir: string, rest: string[]): boolean => {
    if (rest.length === 0) {
      return fs.existsSync(path.join(dir, "page.tsx"));
    }
    const [head, ...tail] = rest;
    if (fs.existsSync(path.join(dir, head)) && walk(path.join(dir, head), tail)) {
      return true;
    }
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^\[.*\]$/.test(entry.name))
      .some((entry) => walk(path.join(dir, entry.name), tail));
  };
  return walk(APP_DIR, segments);
}

describe("finance menu tree (MAPPING_V2)", () => {
  it("keeps the live top-menu order with the M-KOPA menus appended", () => {
    expect(financeMenu.map((item) => item.label)).toEqual([
      "Home", "Branch", "Customer", "Individual Loan", "Groups Loan", "Hq Bank Balance", "Salary Advance", "Staff Loan", "Penalty",
      "Hq Expenses", "Branch Expenses", "Report", "HRM", "Capital", "Accounting", "Insurance & Agent", "Settings",
    ]);
  });

  it("lists the submenus in mapped order", () => {
    const labels = (name: string) => financeMenu.find((item) => item.label === name)?.children?.map((child) => child.label);
    expect(labels("Customer")).toEqual(["Customer Profile", "All customer", "Register Customer"]);
    expect(labels("Individual Loan")).toEqual([
      "Loan Application", "Loan request", "Credit Review", "Disbursement", "Loan disbursed", "Loan withdrawal", "Teller Dashboard", "Default loan",
      "Receivable", "Received", "Loan pending", "Penalty list", "Loan Rejected",
    ]);
    expect(labels("Groups Loan")).toEqual(["Group List"]);
    expect(labels("Hq Bank Balance")?.slice(0, 4)).toEqual(["Account Balance", "Requested Transaction", "From HQ Approved Transaction", "Received Transaction"]);
    expect(labels("Salary Advance")).toEqual(["Requested", "Approved", "Active", "Repayments", "Salary Advance Paid List", "Salary Advance Category"]);
    expect(labels("Staff Loan")).toEqual(["Approved Loan", "Active Loan", "Staff Salary Advance"]);
    expect(labels("Penalty")).toEqual(["Penalty List", "Paid Penalty"]);
    expect(labels("Hq Expenses")?.slice(0, 2)).toEqual(["Request Expenses", "Approved Expenses"]);
    expect(labels("Branch Expenses")?.slice(0, 2)).toEqual(["Requested Expenses", "Approved Expenses"]);
    expect(labels("Report")?.slice(0, 7)).toEqual([
      "Cash transaction", "Today Received", "Saving Deposit Balance", "Customer Development", "Loan Pending", "Default Loan", "Customer Account statement",
    ]);
    expect(labels("HRM")?.slice(0, 3)).toEqual(["Active Staff", "Rejected Staff", "Branch & Staff"]);
    expect(labels("Capital")).toEqual([
      "Shareholders", "Add Capitals", "Assets", "Dividends", "Shares", "Float", "Float Branch To Branch", "Approved Float", "Float Ac-Ac", "Dividend Settings",
    ]);
    expect(labels("Accounting")?.slice(0, 3)).toEqual(["Chart of Accounts", "Journal Entries", "Month End & Profit"]);
    const fundPosition = financeMenu.find((item) => item.label === "Accounting")?.children?.find((child) => child.label === "Cash & Fund Position");
    expect(fundPosition).toEqual({ label: "Cash & Fund Position", href: "/reports/fund-position", permission: "reports.financial" });
    expect(routeExists("/reports/fund-position")).toBe(true);
    const financial = menu.flatMap((tab) => tab.items).find((item) => item.label === "Financial");
    expect(financial?.children?.find((child) => child.href === "/reports/fund-position")?.permission).toBe("reports.financial");
  });

  it("links Pending Approvals (approvals.view) and the Approval Policy settings page (settings.manage) in both menus", () => {
    const accounting = financeMenu.find((item) => item.label === "Accounting")?.children ?? [];
    expect(accounting.find((child) => child.href === "/approvals")).toEqual({ label: "Pending Approvals", href: "/approvals", permission: "approvals.view" });
    const settings = financeMenu.find((item) => item.label === "Settings")?.children ?? [];
    expect(settings.find((child) => child.href === "/settings/approval-policy")).toEqual({ label: "Approval Policy", href: "/settings/approval-policy", permission: "settings.manage" });
    const sidebar = menu.flatMap((tab) => tab.items);
    expect(sidebar.find((item) => item.href === "/approvals")?.permission).toBe("approvals.view");
    expect(sidebar.flatMap((item) => item.children ?? []).find((child) => child.href === "/settings/approval-policy")?.permission).toBe("settings.manage");
    expect(routeExists("/approvals")).toBe(true);
    expect(routeExists("/settings/approval-policy")).toBe(true);

    const financeAccounting = visibleFinanceMenu(financeMenu, canWith(FINANCE_PERMISSIONS)).find((item) => item.label === "Accounting")?.children?.map((child) => child.href);
    expect(financeAccounting).toContain("/approvals");
    const withoutView = FINANCE_PERMISSIONS.filter((permission) => permission !== "approvals.view");
    expect(visibleFinanceMenu(financeMenu, canWith(withoutView)).find((item) => item.label === "Accounting")?.children?.map((child) => child.href)).not.toContain("/approvals");
  });

  it("omits live items that have no M-KOPA equivalent", () => {
    const all = financeMenu.flatMap((item) => [item.label, ...(item.children ?? []).map((child) => child.label)]);
    expect(all).not.toContain("Servant Loan");
    expect(all).not.toContain("Full statement");
    expect(all).not.toContain("Expenses Account");
  });

  it("links only to existing app routes (no dead links)", () => {
    const hrefs = [...financeMenu.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]), ...financeUserLinks.map((link) => link.href)].filter(
      (href): href is string => !!href,
    );
    const missing = hrefs.filter((href) => !routeExists(href));
    expect(missing).toEqual([]);
  });

  it("uses the same permission as the sidebar menu for every page both menus link to", () => {
    const sidebar = new Map<string, Permission | undefined>();
    for (const tab of menu) {
      for (const item of tab.items) {
        if (item.href) {
          sidebar.set(item.href, item.permission);
        }
        item.children?.forEach((child) => sidebar.set(child.href, child.permission));
      }
    }
    const mismatched = financeMenu
      .flatMap((item) => [...(item.href ? [{ href: item.href, permission: item.permission }] : []), ...(item.children ?? [])])
      .filter((link) => sidebar.has(link.href) && JSON.stringify(normalise(sidebar.get(link.href))) !== JSON.stringify(normalise(link.permission)))
      .map((link) => link.href);
    expect(mismatched).toEqual([]);
  });

  it("gives every sidebar page reachable by some permission a place in the finance menu", () => {
    const financeHrefs = new Set([...financeMenu.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]), ...financeUserLinks.map((link) => link.href)]);
    const sidebarHrefs = menu.flatMap((tab) => tab.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)])).filter((href): href is string => !!href);
    expect(sidebarHrefs.filter((href) => !financeHrefs.has(href))).toEqual([]);
  });

  it("contains no retired terminology or foreign branding", () => {
    const text = JSON.stringify([financeMenu, financeUserLinks]);
    for (const banned of ["Customer Category", "Customer Categories", "Main Loan Category", "MIKOPOFASTA", "MikopoFasta"]) {
      expect(text).not.toContain(banned);
    }
    for (const file of ["../components/layout/FinanceTopbar.tsx", "../components/finance-dashboard/FinanceDashboard.tsx", "../components/finance-dashboard/kpis.ts"]) {
      const source = fs.readFileSync(path.resolve(__dirname, file), "utf8");
      expect(source).not.toMatch(/MIKOPOFASTA|Customer Categor|Main Loan Category/);
    }
  });
});

describe("finance menu permission filtering", () => {
  it("shows the Finance role only what it may open and drops empty dropdowns", () => {
    const visible = visibleFinanceMenu(financeMenu, canWith(FINANCE_PERMISSIONS));
    const labels = visible.map((item) => item.label);
    expect(labels).not.toContain("Settings");
    expect(labels).toContain("Capital");
    const capital = visible.find((item) => item.label === "Capital")?.children?.map((child) => child.label);
    expect(capital).toEqual(["Float", "Float Branch To Branch", "Approved Float", "Float Ac-Ac"]);
    const loans = visible.find((item) => item.label === "Individual Loan")?.children?.map((child) => child.label);
    expect(loans).not.toContain("Teller Dashboard");
    expect(loans).not.toContain("Loan Application");
    expect(loans).toContain("Disbursement");
    const hrm = visible.find((item) => item.label === "HRM")?.children?.map((child) => child.label);
    expect(hrm).toEqual(["Salary Sheet", "Payroll", "Commission", "Staff Fund"]);
  });

  it("hides an item as soon as its permission is revoked", () => {
    const withoutHq = FINANCE_PERMISSIONS.filter((permission) => permission !== "hq.manage");
    const bank = visibleFinanceMenu(financeMenu, canWith(withoutHq)).find((item) => item.label === "Hq Bank Balance")?.children?.map((child) => child.href);
    expect(bank).not.toContain("/hq/balances");
    expect(bank).toContain("/bank/balances");

    const withoutGroups = FINANCE_PERMISSIONS.filter((permission) => permission !== "groups.view");
    expect(visibleFinanceMenu(financeMenu, canWith(withoutGroups)).map((item) => item.label)).not.toContain("Groups Loan");
  });

  it("shows Settings and Capital pages when those permissions are granted", () => {
    const visible = visibleFinanceMenu(financeMenu, canWith([...FINANCE_PERMISSIONS, "settings.manage", "capital.view", "capital.manage", "shares.view"]));
    expect(visible.map((item) => item.label)).toContain("Settings");
    expect(visible.find((item) => item.label === "Capital")?.children).toHaveLength(10);
  });

  it("returns nothing for a user without permissions except permission-free entries", () => {
    expect(visibleFinanceMenu(financeMenu, canWith([]))).toEqual([]);
  });
});

describe("finance shell selection and active item", () => {
  it("selects the Head Office shell only for the finance role key", () => {
    expect(usesFinanceShell({ role: { key: "finance" } })).toBe(true);
    for (const key of ["super_admin", "admin", "teller", "branch_manager", "loan_officer", "credit_officer", "hr", "zone_manager"]) {
      expect(usesFinanceShell({ role: { key } })).toBe(false);
    }
    expect(usesFinanceShell({ role: null })).toBe(false);
    expect(usesFinanceShell(null)).toBe(false);
  });

  it("highlights the menu owning the current page, preferring exact matches", () => {
    expect(activeFinanceItem(financeMenu, "/dashboard")).toBe("Home");
    expect(activeFinanceItem(financeMenu, "/hq/transactions/approved")).toBe("Hq Bank Balance");
    expect(activeFinanceHref(financeMenu, "/hq/transactions/approved")).toBe("/hq/transactions/approved");
    expect(activeFinanceItem(financeMenu, "/customers/12")).toBe("Customer");
    expect(activeFinanceHref(financeMenu, "/customers/12")).toBe("/customers");
    expect(activeFinanceItem(financeMenu, "/capital/floats/branch")).toBe("Capital");
    expect(activeFinanceItem(financeMenu, "/reports/received")).toBe("Individual Loan");
    expect(activeFinanceItem(financeMenu, "/nowhere")).toBeNull();
  });
});
