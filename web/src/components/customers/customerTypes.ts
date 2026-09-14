/**
 * Customer Type options. The only source of the types is the API (GET /customer-types, backed by the configured
 * customer_categories rows) — no screen keeps its own list of type names.
 */
import type { CustomerType } from "./types";

/** Read-only API list of the selectable (active) customer types, in display order. */
export const CUSTOMER_TYPES_ENDPOINT = "customer-types";

export const CUSTOMER_TYPE_LABEL = "Customer Type";

/** The Customer Type filter shown on the customer list and the customer search. */
export const CUSTOMER_TYPE_FILTER = {
  inputId: "filter-type",
  label: CUSTOMER_TYPE_LABEL,
  placeholder: `${CUSTOMER_TYPE_LABEL}: all`,
} as const;

export interface CustomerTypeOption {
  value: string;
  label: string;
  hint?: string;
}

type TypeRow = Pick<CustomerType, "id" | "name" | "isActive" | "sortOrder"> & Partial<Pick<CustomerType, "deletedAt" | "requiresExtraApproval">>;

/** Active, not deleted types in display order (sort order, then name). */
export function selectableCustomerTypes<T extends TypeRow>(types: readonly T[] | null | undefined): T[] {
  return [...(types ?? [])]
    .filter((type) => type.isActive && !type.deletedAt)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

/** Select / filter options built from the API rows. */
export function customerTypeOptions(types: readonly TypeRow[] | null | undefined, { withHints = false } = {}): CustomerTypeOption[] {
  return selectableCustomerTypes(types).map((type) => ({
    value: String(type.id),
    label: type.name,
    ...(withHints && type.requiresExtraApproval ? { hint: "Needs extra approval" } : {}),
  }));
}
