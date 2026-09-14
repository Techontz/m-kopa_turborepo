import { describe, expect, it } from "vitest";

import {
  assetPayload,
  computeTotal,
  emptyAssetForm,
  eventChange,
  findType,
  formatDecimal,
  formLayout,
  identifierSummary,
  labelLines,
  registryRow,
  statusTone,
  type AssetConfig,
  type AssetRow,
} from "./assets";

const field = (key: string, required = true, identifier = false) => ({ key, label: key.replace(/_/g, " "), type: "text" as const, required, identifier, min: null, max: null, options: null });

const config: AssetConfig = {
  types: [
    { value: "vehicle", label: "Vehicle", account: "motor_vehicles", account_label: "MOTOR VEHICLES", fixed_quantity: false, condition: true, location_required: false, fields: [field("make"), field("registration_number", true, true)], documents: [] },
    { value: "electronics", label: "Electronics", account: "equipment", account_label: "EQUIPMENT & ELECTRONICS", fixed_quantity: false, condition: true, location_required: false, fields: [field("brand"), field("serial_number", true, true), field("imei", false, true)], documents: [] },
    { value: "land", label: "Land", account: "land", account_label: "LAND", fixed_quantity: true, condition: false, location_required: true, fields: [field("plot_number", true, true)], documents: [] },
  ],
  conditions: [],
  valuation_methods: [],
  statuses: [],
  document_mimes: ["pdf"],
  document_max_kb: 10240,
};

const asset: AssetRow = {
  id: 7,
  asset_code: "AST-000007",
  name: "HP Laptops",
  asset_type: "electronics",
  asset_type_label: "Electronics",
  description: "Five HP EliteBook 840 laptops for the loan officers in the Mwanza branch",
  share_holder_id: 1,
  share_holder: "ALPHA HOLDER",
  quantity: 5,
  unit_value: 500000,
  contribution_value: 2500000,
  current_value: 2000000,
  branch_id: 1,
  branch: "MWANZA",
  location: "Office",
  condition: "new",
  condition_label: "New",
  status: "in_use",
  status_label: "In Use",
  contributed_on: "2026-09-14",
  specifications: {},
  identifiers: { "IMEI": "35-1", "Serial Number": "SN-9" },
  ledger_account: "equipment",
  ledger_account_label: "EQUIPMENT & ELECTRONICS",
  capital_id: 3,
  share_transaction_reference: null,
  qr_endpoint: "capital/assets/7/qr",
  scan_url: "http://localhost:3000/capital/assets/scan/x",
  scan_path: "/capital/assets/scan/x",
};

describe("asset form layout from config", () => {
  it("shows the type's own fields, condition and quantity rules", () => {
    expect(formLayout(findType(config, "vehicle")).fields.map((item) => item.key)).toEqual(["make", "registration_number"]);
    expect(formLayout(findType(config, "vehicle"))).toMatchObject({ showCondition: true, quantityEditable: true, locationRequired: false, account: "MOTOR VEHICLES" });
    expect(formLayout(findType(config, "land"))).toMatchObject({ showCondition: false, quantityEditable: false, locationRequired: true });
    expect(formLayout(undefined).fields).toEqual([]);
  });
});

describe("total contribution value", () => {
  it("multiplies quantity by unit value exactly", () => {
    expect(computeTotal("5", "500000")).toBe("2500000.00");
    expect(computeTotal("3", "0.10")).toBe("0.30");
    expect(computeTotal("3", "333,333.33")).toBe("999999.99");
    expect(formatDecimal(computeTotal("5", "500000"))).toBe("2,500,000");
    expect(formatDecimal("999999.99")).toBe("999,999.99");
  });

  it("returns null for invalid input", () => {
    expect(computeTotal("", "100")).toBeNull();
    expect(computeTotal("1.5", "100")).toBeNull();
    expect(computeTotal("2", "10.555")).toBeNull();
    expect(computeTotal("2", "abc")).toBeNull();
  });
});

describe("asset payload", () => {
  it("sends only the selected type's fields and fixes quantity / condition where configured", () => {
    const form = { ...emptyAssetForm("2026-09-14"), asset_type: "land", quantity: "4", unit_value: "40,000,000", condition: "new", specifications: { plot_number: "PL-1", make: "stale" } };
    const body = assetPayload("9", form, findType(config, "land"), "key-1");
    expect(body).toMatchObject({ share_id: "9", quantity: "1", unit_value: "40000000", total_value: "40000000.00", condition: null, specifications: { plot_number: "PL-1" }, idempotency_key: "key-1" });

    const electronics = assetPayload("9", { ...emptyAssetForm("2026-09-14"), asset_type: "electronics", quantity: "5", unit_value: "500000", condition: "new" }, findType(config, "electronics"), "key-2");
    expect(electronics).toMatchObject({ quantity: "5", total_value: "2500000.00", condition: "new" });
  });
});

describe("registry mapping and label", () => {
  it("maps a registry row", () => {
    const row = registryRow(asset);
    expect(row).toMatchObject({ code: "AST-000007", contributor: "ALPHA HOLDER", branch: "MWANZA", status: "In Use", statusTone: "success", valueChanged: true });
    expect(row.description.endsWith("…")).toBe(true);
    expect(row.description.length).toBeLessThanOrEqual(40);
    expect(row.search).toContain("SN-9");
    expect(identifierSummary(asset.identifiers)).toBe("IMEI: 35-1 · Serial Number: SN-9");
    expect(statusTone("written_off")).toBe("danger");
    expect(statusTone("under_maintenance")).toBe("warning");
  });

  it("builds label lines preferring serial / registration identifiers", () => {
    expect(labelLines(asset)).toEqual({ brand: "M-KOPA", code: "AST-000007", name: "HP Laptops", type: "Electronics", branch: "MWANZA", identifier: { label: "Serial Number", value: "SN-9" } });
    expect(labelLines({ ...asset, identifiers: {} }).identifier).toBeNull();
  });

  it("summarises history events", () => {
    expect(eventChange({ id: 1, event: "transferred", occurred_at: null, employee: null, previous_value: { branch: "MWANZA" }, new_value: { branch: "ARUSHA" }, amount_before: null, amount_after: null, reason: "x" })).toBe("MWANZA → ARUSHA");
    expect(eventChange({ id: 2, event: "written_off", occurred_at: null, employee: null, previous_value: { status: "in_use" }, new_value: { status: "written_off" }, amount_before: null, amount_after: null, reason: null })).toBe("in use → written off");
  });
});
