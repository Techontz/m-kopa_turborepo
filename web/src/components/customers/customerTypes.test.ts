import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// The reference export shipped with the API: what GET /customer-types returns for a seeded company.
import reference from "../../../../api/database/data/customer-module-types.json";
import { CUSTOMER_TYPE_FILTER, CUSTOMER_TYPE_LABEL, CUSTOMER_TYPES_ENDPOINT, customerTypeOptions, selectableCustomerTypes } from "./customerTypes";
import type { CustomerType } from "./types";

const FIVE = ["Mtumishi wa Umma", "Sekta Binafsi", "Mjasiriamali/Mfanyabiashara", "Mwanafunzi wa Chuo", "Mstaafu (Umma)"];

function apiRows(): CustomerType[] {
  return reference.customerTypes.map((item, index) => ({ ...(item as unknown as CustomerType), id: 11 + index, deletedAt: null }));
}

const SRC = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("customer type options come from the API", () => {
  it("offers exactly the five configured types, in sort order, from the API rows", () => {
    const shuffled = [...apiRows()].reverse();
    const options = customerTypeOptions(shuffled);
    expect(options.map((option) => option.label)).toEqual(FIVE);
    expect(options.map((option) => option.value)).toEqual(["11", "12", "13", "14", "15"]);
  });

  it("never offers inactive or deleted types", () => {
    const rows = apiRows();
    rows[3] = { ...rows[3], isActive: false };
    rows[4] = { ...rows[4], deletedAt: "2026-09-01T00:00:00+03:00" };
    expect(selectableCustomerTypes(rows).map((type) => type.name)).toEqual(FIVE.slice(0, 3));
  });

  it("reflects whatever the API returns — there is no built-in list", () => {
    const rows = [
      { id: 7, name: "Zeta", isActive: true, sortOrder: 2 },
      { id: 3, name: "Alpha", isActive: true, sortOrder: 2 },
      { id: 9, name: "First", isActive: true, sortOrder: 1, requiresExtraApproval: true },
    ];
    expect(customerTypeOptions(rows, { withHints: true })).toEqual([
      { value: "9", label: "First", hint: "Needs extra approval" },
      { value: "3", label: "Alpha" },
      { value: "7", label: "Zeta" },
    ]);
    expect(customerTypeOptions([])).toEqual([]);
    expect(customerTypeOptions(undefined)).toEqual([]);
  });

  it("labels the filter Customer Type and reads the customer-types endpoint", () => {
    expect(CUSTOMER_TYPES_ENDPOINT).toBe("customer-types");
    expect(CUSTOMER_TYPE_LABEL).toBe("Customer Type");
    expect(CUSTOMER_TYPE_FILTER).toEqual({ inputId: "filter-type", label: "Customer Type", placeholder: "Customer Type: all" });
  });

  it.each(["app/(app)/customers/page.tsx", "app/(app)/customers/search/page.tsx"])("%s filters by Customer Type with API-driven options", (file) => {
    const source = readFileSync(path.join(SRC, file), "utf8");
    expect(source).toContain("useApi<CustomerType[]>(allowed ? CUSTOMER_TYPES_ENDPOINT : null)");
    expect(source).toContain("placeholder={CUSTOMER_TYPE_FILTER.placeholder}");
    expect(source).toContain("options={customerTypeOptions(types)}");
  });

  it("the registration wizard reads the same endpoint", () => {
    expect(readFileSync(path.join(SRC, "components/customers/wizard/RegisterWizard.tsx"), "utf8")).toContain("useApi<CustomerType[]>(CUSTOMER_TYPES_ENDPOINT)");
    expect(readFileSync(path.join(SRC, "components/customers/wizard/Step1Basic.tsx"), "utf8")).toContain("customerTypeOptions(types, { withHints: true })");
  });

  it("no app source file keeps its own list of the type names or says Customer Category", () => {
    const codes = reference.customerTypes.map((item) => item.code);
    const offenders = sourceFiles(SRC).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return [...FIVE, ...codes, "Customer Categor", "customer categor"].filter((needle) => text.includes(needle)).map((needle) => `${path.relative(SRC, file)}: ${needle}`);
    });
    expect(offenders).toEqual([]);
  });
});
