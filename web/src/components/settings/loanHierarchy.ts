/**
 * Business hierarchy: CUSTOMER TYPE → MAIN LOAN CATEGORY (one per customer type, named after it) → LOAN CATEGORY (the product,
 * with its limits) → LOAN APPLICATION. Every name and list comes from the API; nothing here knows the configured types.
 */

import type { Option } from "@/components/ui/SelectBox";

/** Settings → Customer Types list. Customer types hold no loan configuration (no Loan Limit column). */
export const CUSTOMER_TYPE_COLUMNS = ["Order", "Customer Type", "Sector", "Risk Tier", "Step 2 Questions", "Customers", "Status", "Actions"] as const;

/** Settings → Main Loan Categories list. */
export const MAIN_LOAN_CATEGORY_COLUMNS = ["S/No.", "Customer Type", "Loan Categories", "Active Loan Categories", "Status", "Actions"] as const;

/** Settings → Loan Categories list. */
export const LOAN_CATEGORY_COLUMNS = [
  "S/No.",
  "Customer Type",
  "Loan Category Name",
  "Loan Level",
  "Loan Limit",
  "Interest",
  "Interest Formula",
  "Duration",
  "Number of Repayments",
  "Deduction",
  "Penalty",
  "Approval Status",
  "Top-up %",
  "Take-home %",
  "E-Mandate",
  "Freeze Time",
  "Actions",
] as const;

/** Label of the loan category form select that picks the main loan category. */
export const CUSTOMER_TYPE_SELECT_LABEL = "Customer Type";

/** GET settings/options/main-categories: main loan categories labelled by their customer type. */
export const MAIN_CATEGORY_OPTIONS_ENDPOINT = "settings/options/main-categories";

/** GET settings/main-categories row. */
export interface MainLoanCategory {
  id: number;
  code: string;
  name: string;
  customerType: { id: number; code: string | null; name: string } | null;
  loanCategoriesCount: number;
  activeLoanCategoriesCount: number;
  isEnabled: boolean;
  status: "ENABLED" | "DISABLED";
}

export interface MainLoanCategoryRow {
  id: number;
  customerType: string;
  loanCategories: number;
  activeLoanCategories: number;
  enabled: boolean;
  status: string;
}

/** Rows of the Main Loan Categories page, in API order (the customer types' order); the name is always the customer type's. */
export function mainLoanCategoryRows(categories: MainLoanCategory[] | undefined): MainLoanCategoryRow[] {
  return (categories ?? []).map((category) => ({
    id: category.id,
    customerType: category.customerType?.name ?? category.name,
    loanCategories: category.loanCategoriesCount,
    activeLoanCategories: category.isEnabled ? category.activeLoanCategoriesCount : 0,
    enabled: category.isEnabled,
    status: category.isEnabled ? "ENABLED" : "DISABLED",
  }));
}

/** Customer Type filter of the Loan Categories page: every main loan category, labelled by customer type. */
export function customerTypeFilterOptions(options: Option[] | undefined): Option[] {
  return (options ?? []).map((option) => ({ value: option.value, label: option.label }));
}

interface ApplicationCategory {
  value: string;
  label: string;
  allowed?: boolean;
}

/**
 * Loan categories offered on the application form: exactly those the API returned for the customer (its customer type's active
 * categories). Nothing is added, and a category the API marks as not allowed is dropped.
 */
export function applicationCategoryOptions<T extends ApplicationCategory>(categories: T[] | undefined): T[] {
  return (categories ?? []).filter((category) => category.allowed !== false);
}

/** Empty state of the application form's loan category select. */
export function applicationCategoryEmptyState(customerType: { name: string } | null | undefined, count: number): string | null {
  if (!customerType) {
    return "Assign a customer type to this customer before applying for a loan.";
  }
  if (count === 0) {
    return `No active loan categories for the customer type ${customerType.name}.`;
  }
  return null;
}
