/**
 * Asset capital contributions & Asset Registry — API shapes and pure helpers. The asset form renders from the API's
 * config (api/config/assets.php via GET capital/assets/config), so no field list is duplicated here.
 */

import type { BadgeTone } from "@/components/ui/Badge";

export interface AssetOption {
  value: string;
  label: string;
}

export interface AssetFieldConfig {
  key: string;
  label: string;
  type: "text" | "number" | "integer" | "select" | "textarea";
  required: boolean;
  identifier: boolean;
  min: number | null;
  max: number | null;
  options: AssetOption[] | null;
}

export interface AssetDocumentType {
  key: string;
  label: string;
  required: boolean;
}

export interface AssetTypeConfig {
  value: string;
  label: string;
  account: string;
  account_label: string;
  fixed_quantity: boolean;
  condition: boolean;
  location_required: boolean;
  fields: AssetFieldConfig[];
  documents: AssetDocumentType[];
}

export interface AssetConfig {
  types: AssetTypeConfig[];
  conditions: AssetOption[];
  valuation_methods: AssetOption[];
  statuses: AssetOption[];
  document_mimes: string[];
  document_max_kb: number;
}

export interface AssetRow {
  id: number;
  asset_code: string | null;
  name: string;
  asset_type: string;
  asset_type_label: string;
  description: string;
  share_holder_id: number;
  share_holder: string | null;
  quantity: number;
  unit_value: number;
  contribution_value: number;
  current_value: number;
  branch_id: number;
  branch: string | null;
  location: string | null;
  condition: string | null;
  condition_label: string | null;
  status: string;
  status_label: string;
  contributed_on: string | null;
  specifications: Record<string, string | number>;
  identifiers: Record<string, string>;
  ledger_account: string;
  ledger_account_label: string | null;
  capital_id: number;
  share_transaction_reference: string | null;
  qr_endpoint: string;
  scan_url: string;
  scan_path: string;
}

export interface AssetEventRow {
  id: number;
  event: string;
  occurred_at: string | null;
  employee: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  amount_before: number | null;
  amount_after: number | null;
  reason: string | null;
}

export interface AssetDocumentRow {
  id: number;
  document_type: string;
  original_name: string;
  mime: string;
  size: number;
  uploaded_by: string | null;
  uploaded_at: string | null;
  endpoint: string;
}

export interface AssetDetail extends AssetRow {
  valuation: { method: string; method_label: string; date: string | null; valued_by: string | null; reference: string | null; notes: string | null; contribution_value: number };
  notes: string | null;
  journal_entry_id: number | null;
  journal_reference: string | null;
  recorded_by: string | null;
  created_at: string | null;
  contribution_reversed: boolean;
  reversal_reason: string | null;
  events: AssetEventRow[];
  documents: AssetDocumentRow[];
  document_types: AssetDocumentType[];
}

/** Asset part of the Add Capital form (Pay Method ASSET). Values are kept as strings, as typed. */
export interface AssetForm {
  asset_type: string;
  name: string;
  description: string;
  quantity: string;
  unit_value: string;
  condition: string;
  contribution_date: string;
  branch_id: string;
  location: string;
  notes: string;
  valuation_method: string;
  valuation_date: string;
  valued_by: string;
  valuation_reference: string;
  valuation_notes: string;
  specifications: Record<string, string>;
}

export function emptyAssetForm(today: string): AssetForm {
  return {
    asset_type: "",
    name: "",
    description: "",
    quantity: "1",
    unit_value: "",
    condition: "",
    contribution_date: today,
    branch_id: "",
    location: "",
    notes: "",
    valuation_method: "",
    valuation_date: today,
    valued_by: "",
    valuation_reference: "",
    valuation_notes: "",
    specifications: {},
  };
}

export function findType(config: AssetConfig | undefined, type: string): AssetTypeConfig | undefined {
  return config?.types.find((item) => item.value === type);
}

/** Which parts of the asset form are shown for a type: its own fields, condition, editable quantity, location required. */
export function formLayout(type: AssetTypeConfig | undefined) {
  return {
    fields: type?.fields ?? [],
    showCondition: type ? type.condition : true,
    quantityEditable: type ? !type.fixed_quantity : true,
    locationRequired: type?.location_required ?? false,
    account: type?.account_label ?? null,
  };
}

/** Parse a TZS amount with at most 2 decimals into integer cents; null when not a valid amount. */
export function toCents(value: string): bigint | null {
  const text = value.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
}

/** quantity × unit value in exact decimal ("2500000.00"); null when either input is invalid. Display only — the API recomputes. */
export function computeTotal(quantity: string, unitValue: string): string | null {
  const cents = toCents(unitValue);
  if (!/^\d+$/.test(quantity.trim()) || cents === null) {
    return null;
  }
  const total = cents * BigInt(quantity.trim());
  const text = total.toString().padStart(3, "0");
  return `${text.slice(0, -2)}.${text.slice(-2)}`;
}

/** "2,500,000" / "999,999.99" for a decimal string. */
export function formatDecimal(value: string | null): string {
  if (value === null) {
    return "";
  }
  const [whole, fraction] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction && fraction !== "00" ? `${grouped}.${fraction}` : grouped;
}

/** JSON body for POST capital/assets: only the selected type's fields, quantity 1 for fixed types, no condition where it does not apply. */
export function assetPayload(shareId: string, form: AssetForm, type: AssetTypeConfig | undefined, idempotencyKey: string): Record<string, unknown> {
  const layout = formLayout(type);
  const specifications: Record<string, string> = {};
  for (const field of layout.fields) {
    const value = form.specifications[field.key];
    if (value !== undefined && value !== "") {
      specifications[field.key] = value;
    }
  }
  const quantity = layout.quantityEditable ? form.quantity : "1";
  const blank = (value: string) => (value.trim() === "" ? null : value.trim());

  return {
    share_id: shareId,
    asset_type: form.asset_type,
    name: form.name.trim(),
    description: form.description.trim(),
    quantity,
    unit_value: form.unit_value.replace(/,/g, ""),
    total_value: computeTotal(quantity, form.unit_value),
    condition: layout.showCondition ? blank(form.condition) : null,
    contribution_date: form.contribution_date,
    branch_id: form.branch_id,
    location: blank(form.location),
    notes: blank(form.notes),
    valuation_method: form.valuation_method,
    valuation_date: form.valuation_date,
    valued_by: blank(form.valued_by),
    valuation_reference: blank(form.valuation_reference),
    valuation_notes: blank(form.valuation_notes),
    specifications,
    idempotency_key: idempotencyKey,
  };
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
    case "in_use":
      return "success";
    case "available":
      return "info";
    case "under_maintenance":
      return "warning";
    case "disposed":
    case "written_off":
    case "reversed":
      return "danger";
    default:
      return "default";
  }
}

export const TERMINAL_STATUSES = ["disposed", "written_off", "reversed"];

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function truncate(text: string | null | undefined, length = 40): string {
  const value = (text ?? "").trim();
  return value.length > length ? `${value.slice(0, length - 1).trimEnd()}…` : value;
}

/** "Registration Number: T 123 ABC · Chassis Number: CH-1" */
export function identifierSummary(identifiers: Record<string, string> | null | undefined): string {
  return Object.entries(identifiers ?? {}).map(([label, value]) => `${label}: ${value}`).join(" · ");
}

/** Registry table row values used for search, sort and display. */
export function registryRow(asset: AssetRow) {
  return {
    id: asset.id,
    code: asset.asset_code ?? "—",
    name: asset.name,
    type: asset.asset_type_label,
    description: truncate(asset.description),
    contributor: asset.share_holder ?? "—",
    contributionValue: asset.contribution_value,
    currentValue: asset.current_value,
    valueChanged: asset.current_value !== asset.contribution_value,
    branch: asset.branch ?? "—",
    location: asset.location ?? "—",
    condition: asset.condition_label ?? "—",
    status: asset.status_label,
    statusTone: statusTone(asset.status),
    contributedOn: asset.contributed_on ?? "—",
    identifiers: identifierSummary(asset.identifiers),
    search: [asset.asset_code, asset.name, asset.description, asset.share_holder, asset.branch, asset.location, ...Object.values(asset.identifiers ?? {})].filter(Boolean).join(" "),
  };
}

export const LABEL_BRAND = "M-KOPA";

/** Printable label lines: brand, Asset ID, name, type, branch and the first serial / registration identifier present. */
export function labelLines(asset: Pick<AssetRow, "asset_code" | "name" | "asset_type_label" | "branch" | "identifiers">) {
  const identifiers = Object.entries(asset.identifiers ?? {});
  const preferred = identifiers.find(([label]) => /registration|serial/i.test(label)) ?? identifiers[0];
  return {
    brand: LABEL_BRAND,
    code: asset.asset_code ?? "",
    name: asset.name,
    type: asset.asset_type_label,
    branch: asset.branch ?? "",
    identifier: preferred ? { label: preferred[0], value: preferred[1] } : null,
  };
}

const EVENT_LABELS: Record<string, string> = {
  created: "Created",
  contributed_as_capital: "Contributed as capital",
  allocated_to_branch: "Allocated to branch",
  transferred: "Transferred",
  revalued: "Revalued",
  maintenance: "Under maintenance",
  disposed: "Disposed",
  written_off: "Written off",
  status_changed: "Status changed",
  updated: "Details updated",
  document_uploaded: "Document uploaded",
  document_deleted: "Document deleted",
  contribution_reversed: "Contribution reversed",
};

export function eventLabel(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/_/g, " ");
}

/** Short human summary of an event's before → after values. */
export function eventChange(event: AssetEventRow): string {
  const previous = event.previous_value ?? {};
  const next = event.new_value ?? {};
  switch (event.event) {
    case "transferred":
      return `${previous.branch ?? "—"} → ${next.branch ?? "—"}`;
    case "allocated_to_branch":
      return `${next.branch ?? "—"}${next.location ? ` (${next.location})` : ""}`;
    case "maintenance":
    case "disposed":
    case "written_off":
    case "status_changed":
    case "contribution_reversed":
      return `${String(previous.status ?? "—").replace(/_/g, " ")} → ${String(next.status ?? "—").replace(/_/g, " ")}`;
    case "updated":
      return Object.keys(next).join(", ");
    case "document_uploaded":
      return `${next.document_type ?? ""}: ${next.name ?? ""}`;
    case "document_deleted":
      return `${previous.document_type ?? ""}: ${previous.name ?? ""}`;
    case "contributed_as_capital":
      return `${next.share_holder ?? ""} · Dr ${next.ledger_account ?? ""} / Cr CAPITAL ACCOUNT`;
    default:
      return "";
  }
}
