/**
 * Business model: CUSTOMER TYPE (1) → (many) LOAN CATEGORY (the product, with its limits) → LOAN APPLICATION. Every loan
 * category references exactly one customer type by id; every name and list comes from the API.
 */

import { CUSTOMER_TYPES_ENDPOINT, customerTypeOptions } from "@/components/customers/customerTypes";
import type { CustomerType } from "@/components/customers/types";
import type { Option } from "@/components/ui/SelectBox";

/** Settings → Customer Types list. Customer types hold no loan configuration (no Loan Limit column). */
export const CUSTOMER_TYPE_COLUMNS = ["Order", "Customer Type", "Sector", "Risk Tier", "Step 2 Questions", "Customers", "Status", "Actions"] as const;

/** Settings → Loan Categories list. */
export const LOAN_CATEGORY_COLUMNS = [
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
] as const;

/** Label of the single Customer Type select of the loan category form. */
export const CUSTOMER_TYPE_SELECT_LABEL = "Customer Type";

/** GET /customer-types: the active customer types (customer_categories) — options of the form select and the list filter. */
export const CUSTOMER_TYPE_OPTIONS_ENDPOINT = CUSTOMER_TYPES_ENDPOINT;

/** Request key of the loan category's customer type (settings/loan-categories store / update). */
export const CUSTOMER_TYPE_FIELD = "customer_type_id";

type TypeRow = Pick<CustomerType, "id" | "name" | "isActive" | "sortOrder">;

/**
 * Options of the loan category form's Customer Type select: the API's active types, plus the category's current type when it
 * is no longer active (so an edit still shows it).
 */
export function loanCategoryCustomerTypeOptions(types: readonly TypeRow[] | undefined, current?: { id: number; name: string } | null): Option[] {
  const options: Option[] = customerTypeOptions(types).map(({ value, label }) => ({ value, label }));
  if (current && !options.some((option) => option.value === String(current.id))) {
    options.push({ value: String(current.id), label: `${current.name} (inactive)` });
  }
  return options;
}

/** Customer Type filter of the Loan Categories page, from GET /customer-types. */
export function customerTypeFilterOptions(types: readonly TypeRow[] | undefined): Option[] {
  return loanCategoryCustomerTypeOptions(types);
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
