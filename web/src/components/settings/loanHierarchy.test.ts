import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { menu, type MenuItem } from "@/lib/menu";

import {
  applicationCategoryEmptyState,
  applicationCategoryOptions,
  CUSTOMER_TYPE_COLUMNS,
  CUSTOMER_TYPE_FIELD,
  CUSTOMER_TYPE_OPTIONS_ENDPOINT,
  CUSTOMER_TYPE_SELECT_LABEL,
  customerTypeFilterOptions,
  LOAN_CATEGORY_COLUMNS,
  loanCategoryCustomerTypeOptions,
} from "./loanHierarchy";

const SRC = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(SRC, file), "utf8");

/** Shape of GET /customer-types — names are placeholders, not the configured types. */
function apiTypes() {
  return [
    { id: 3, name: "Type C", isActive: true, sortOrder: 3 },
    { id: 1, name: "Type A", isActive: true, sortOrder: 1 },
    { id: 2, name: "Type B", isActive: true, sortOrder: 2 },
    { id: 9, name: "Brand New Type", isActive: true, sortOrder: 9 },
  ];
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

describe("loan category form and list", () => {
  it("has exactly one Customer Type select sourced from GET /customer-types and no Allowed Customer Types / main category", () => {
    const fields = read("components/settings/LoanCategoryFields.tsx");
    expect(CUSTOMER_TYPE_SELECT_LABEL).toBe("Customer Type");
    expect(CUSTOMER_TYPE_OPTIONS_ENDPOINT).toBe("customer-types");
    expect(CUSTOMER_TYPE_FIELD).toBe("customer_type_id");
    expect(fields).toContain("useApi<CustomerType[]>(CUSTOMER_TYPE_OPTIONS_ENDPOINT)");
    expect(fields.match(/select\("customer_type_id"/g)).toHaveLength(1);
    expect(fields.match(/CUSTOMER_TYPE_SELECT_LABEL/g)?.length).toBe(2); // import + the one field
    for (const needle of ["Allowed Customer Types", "customer_category_ids", "Main Loan Category", "main_category", "Loan Type", "main_id", "multiple"]) {
      expect(fields).not.toContain(needle);
    }
  });

  it("orders the form fields as agreed, Loan Category Name first and Customer Type second", () => {
    const fields = read("components/settings/LoanCategoryFields.tsx");
    const labels = [...fields.matchAll(/<Field label=(?:"([^"]+)"|\{(CUSTOMER_TYPE_SELECT_LABEL)\})/g)].map((match) => match[1] ?? "Customer Type");
    expect(labels).toEqual([
      "Loan Category Name",
      "Customer Type",
      "Loan Amount From",
      "Loan Amount To",
      "Loan Interest (%)",
      "Interest Formula",
      "Loan Duration",
      "Repayment Level From",
      "Repayment Level To",
      "Allow Deduction?",
      "Allow Penalty?",
      "Approve Status",
      "Top-up Percent (%)",
      "Freeze Time (Days)",
      "Take Home Percent (%)",
      "Requires E-Mandate? (Bank deduction)",
    ]);
  });

  it("builds the select options from the API types in display order, keeping an inactive current type on edit", () => {
    expect(loanCategoryCustomerTypeOptions(apiTypes()).map((option) => option.label)).toEqual(["Type A", "Type B", "Type C", "Brand New Type"]);
    expect(loanCategoryCustomerTypeOptions(apiTypes(), { id: 2, name: "Type B" })).toHaveLength(4);
    expect(loanCategoryCustomerTypeOptions(apiTypes(), { id: 7, name: "Retired" }).at(-1)).toEqual({ value: "7", label: "Retired (inactive)" });
    expect(customerTypeFilterOptions(undefined)).toEqual([]);
  });

  it("lists loan categories with exactly the agreed columns and a Customer Type filter", () => {
    expect([...LOAN_CATEGORY_COLUMNS]).toEqual([
      "S/No.",
      "Customer Type",
      "Loan Category Name",
      "Loan Level",
      "Loan Interest",
      "Interest Formula",
      "Duration",
      "Number of Repayments",
      "Deduction",
      "Penalty",
      "Approve Status",
      "Top-up %",
      "Freeze Time",
      "Take Home %",
      "E-Mandate",
      "Action",
    ]);
    expect(LOAN_CATEGORY_COLUMNS).not.toContain("Customer Types");
    const page = read("app/(app)/settings/loan-categories/page.tsx");
    expect(page).toContain("LOAN_CATEGORY_COLUMNS[15]");
    expect(page).not.toContain("LOAN_CATEGORY_COLUMNS[16]");
    expect(page).toContain("{ customer_type_id: customerType }");
    expect(page).toContain("row.customer_type?.name");
    for (const needle of ["Loan Type", "Customer Types", "main_category"]) {
      expect(page).not.toContain(needle);
    }
  });

  it("has no Main Loan Categories menu item and keeps the Settings order; old URLs redirect", () => {
    const settings = menu.flatMap((tab) => tab.items).find((item: MenuItem) => item.label === "Settings");
    expect(settings?.children?.map((item) => item.label)).toEqual([
      "Customer Types",
      "Branch",
      "Zones",
      "Interest Formula",
      "Loan Categories",
      "Master Data",
      "Geography",
      "Loan Fee",
      "Penalty",
      "Reserve Setting",
      "Dividend Settings",
      "Approval Policy",
      "Roles & Permissions",
    ]);
    expect(JSON.stringify(menu)).not.toMatch(/main-categories|Main Loan Categor/);
    expect(read("app/(app)/settings/main-categories/[[...slug]]/page.tsx")).toContain('redirect("/settings/loan-categories")');
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
