import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  applicationCategoryEmptyState,
  applicationCategoryOptions,
  CUSTOMER_TYPE_COLUMNS,
  CUSTOMER_TYPE_SELECT_LABEL,
  LOAN_CATEGORY_COLUMNS,
  MAIN_CATEGORY_OPTIONS_ENDPOINT,
  MAIN_LOAN_CATEGORY_COLUMNS,
  mainLoanCategoryRows,
  type MainLoanCategory,
} from "./loanHierarchy";

const SRC = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8");

/** Shape of GET settings/main-categories for a seeded company — names are placeholders, not the configured types. */
function apiGroups(): MainLoanCategory[] {
  return ["Type A", "Type B", "Type C", "Type D", "Type E"].map((name, index) => ({
    id: 10 + index,
    code: `CODE_${index}`,
    name: `stale ${index}`,
    customerType: { id: 100 + index, code: `CODE_${index}`, name },
    loanCategoriesCount: index,
    activeLoanCategoriesCount: index > 0 ? index - 1 : 0,
    isEnabled: index !== 1,
    status: index !== 1 ? "ENABLED" : "DISABLED",
  }));
}

describe("customer types list", () => {
  it("has the agreed columns and no Loan Limit", () => {
    expect([...CUSTOMER_TYPE_COLUMNS]).toEqual(["Order", "Customer Type", "Sector", "Risk Tier", "Step 2 Questions", "Customers", "Status", "Actions"]);
    const page = read("app/(app)/settings/customer-categories/page.tsx");
    expect(page).toContain("CUSTOMER_TYPE_COLUMNS[");
    for (const needle of ["Loan Limit", "minLoanAmount", "maxLoanAmount", "loanCategoryIds", "Allowed loan products"]) {
      expect(page).not.toContain(needle);
    }
  });
});

describe("main loan categories page", () => {
  it("shows the five groups from the API, named after their customer type, with counts and status", () => {
    const rows = mainLoanCategoryRows(apiGroups());
    expect(rows.map((row) => row.customerType)).toEqual(["Type A", "Type B", "Type C", "Type D", "Type E"]);
    expect(rows[1]).toEqual({ id: 11, customerType: "Type B", loanCategories: 1, activeLoanCategories: 0, enabled: false, status: "DISABLED" });
    expect(rows[3]).toMatchObject({ loanCategories: 3, activeLoanCategories: 2, status: "ENABLED" });
    expect(mainLoanCategoryRows(undefined)).toEqual([]);
    expect([...MAIN_LOAN_CATEGORY_COLUMNS]).toEqual(["S/No.", "Customer Type", "Loan Categories", "Active Loan Categories", "Status", "Actions"]);
    const page = read("app/(app)/settings/main-categories/page.tsx");
    expect(page).toContain('useApi<MainLoanCategory[]>("settings/main-categories")');
    expect(page).not.toMatch(/<input/);
  });
});

describe("loan category form and list", () => {
  it("uses a Customer Type select fed by the API and no Allowed Customer Types", () => {
    const fields = read("components/settings/LoanCategoryFields.tsx");
    expect(CUSTOMER_TYPE_SELECT_LABEL).toBe("Customer Type");
    expect(MAIN_CATEGORY_OPTIONS_ENDPOINT).toBe("settings/options/main-categories");
    expect(fields).toContain("useApi<Option[]>(MAIN_CATEGORY_OPTIONS_ENDPOINT)");
    expect(fields).toContain('select("main_category_id", "Select Customer Type", mains)');
    for (const needle of ["Allowed Customer Types", "customer_category_ids", "Main Loan Category", "Loan Type", "main_id"]) {
      expect(fields).not.toContain(needle);
    }
  });

  it("lists loan categories by customer type with the product columns including Freeze Time", () => {
    expect(LOAN_CATEGORY_COLUMNS[1]).toBe("Customer Type");
    expect(LOAN_CATEGORY_COLUMNS).toContain("Freeze Time");
    expect(LOAN_CATEGORY_COLUMNS).toContain("E-Mandate");
    const page = read("app/(app)/settings/loan-categories/page.tsx");
    expect(page).toContain("LOAN_CATEGORY_COLUMNS[16]");
    expect(page).not.toContain("Loan Type");
    expect(page).not.toContain("Customer Types");
  });
});

describe("loan application", () => {
  const categories = [
    { value: "7", label: "PRODUCT A / 100000 - 500000", allowed: true },
    { value: "9", label: "PRODUCT B / 500000 - 1500000", allowed: true },
  ];

  it("offers exactly the loan categories the API returned for the customer", () => {
    expect(applicationCategoryOptions(categories)).toEqual(categories);
    expect(applicationCategoryOptions([...categories, { value: "3", label: "OTHER TYPE", allowed: false }]).map((item) => item.value)).toEqual(["7", "9"]);
    expect(applicationCategoryOptions(undefined)).toEqual([]);
  });

  it("explains an empty list", () => {
    expect(applicationCategoryEmptyState(null, 0)).toBe("Assign a customer type to this customer before applying for a loan.");
    expect(applicationCategoryEmptyState({ name: "Type A" }, 0)).toBe("No active loan categories for the customer type Type A.");
    expect(applicationCategoryEmptyState({ name: "Type A" }, 2)).toBeNull();
  });

  it("the form renders only those categories and the page shows the customer type", () => {
    expect(read("components/loans/LoanFormFields.tsx")).toContain("applicationCategoryOptions(apiCategories)");
    const page = read("app/(app)/loans/apply/page.tsx");
    expect(page).toContain("options?.customer_type?.name");
    expect(page).not.toContain("min_amount");
  });
});
