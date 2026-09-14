import { describe, expect, it } from "vitest";

import type { Customer, CustomerType, FaceScanResource, FieldDef } from "../types";
import { composeStep2Fields } from "../wizard/composition";
import { buildDetailSections, faceAuditRecord, faceChecklist, featuredScan, formatDuration, groupTypeFields, imageQualityMeters, type DetailItem, type DetailSection } from "./detailSections";

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 7,
    customerNumber: "CU-000007",
    firstName: "ASHA",
    middleName: null,
    lastName: "JUMA",
    fullName: "ASHA JUMA",
    phone: "0720000000",
    paymentMethod: "bank",
    kycStatus: "incomplete",
    approvalStatus: "pending",
    dynamicFormData: {},
    documents: [],
    faceScanQuality: null,
    faceVerifiedAt: null,
    faceScannedAt: null,
    faceScanStatus: null,
    ...overrides,
  } as unknown as Customer;
}

const publicServant: CustomerType = {
  id: 1,
  name: "Mtumishi wa Umma",
  code: "PUBLIC",
  formTitle: "Taarifa za Mtumishi wa Umma",
  isActive: true,
  sortOrder: 1,
  sector: "employment",
  dynamicFormSchema: [
    { key: "taasisi", label: "Wizara / Taasisi ya Serikali", type: "select", dataSource: "government-bodies" },
    { key: "kituo", label: "Kituo cha Kazi", type: "text" },
  ],
  omittedStandardFields: ["check_number"],
};

const business: CustomerType = { ...publicServant, id: 3, name: "Mfanyabiashara", formTitle: null, sector: "business", dynamicFormSchema: [{ key: "jina_biashara", label: "Jina la Biashara", type: "text" }], omittedStandardFields: [] };

const section = (sections: DetailSection[], key: DetailSection["key"]) => sections.find((item) => item.key === key);
const labels = (value: DetailSection | undefined) => (value?.items ?? []).map((item: DetailItem) => item.label);

describe("buildDetailSections", () => {
  it("always has basic, additional, account, KYC and face cards", () => {
    const keys = buildDetailSections(customer(), undefined).map((item) => item.key);
    expect(keys).toEqual(["basic", "additional", "account", "kyc", "face"]);
  });

  it("titles the type card with the type's card title and lists the configured fields in order", () => {
    const sections = buildDetailSections(customer(), publicServant);
    const typeCard = section(sections, "type");
    expect(typeCard?.title).toBe("TAARIFA ZA MTUMISHI WA UMMA");
    expect(labels(typeCard)).toEqual(["Wizara / Taasisi ya Serikali", "Kituo cha Kazi"]);
  });

  it("follows the configuration: a field removed from the type disappears even when an answer is stored", () => {
    const trimmed: CustomerType = { ...publicServant, dynamicFormSchema: [(publicServant.dynamicFormSchema as FieldDef[])[1]] };
    const sections = buildDetailSections(customer({ dynamicFormData: { taasisi: 3, kituo: "Dodoma" } }), trimmed);
    expect(labels(section(sections, "type"))).toEqual(["Kituo cha Kazi"]);
  });

  it("puts composed standard employment fields in Employment, honouring omitted standard fields", () => {
    const employment = section(buildDetailSections(customer(), publicServant), "employment");
    const composedColumns = composeStep2Fields(publicServant).filter((field) => field.origin === "standard").map((field) => field.storesIn);
    expect(employment?.items.map((item) => item.key)).toEqual(composedColumns);
    expect(labels(employment)).not.toContain("Check Number");
    expect(labels(employment)).toContain("Basic Salary");
  });

  it("still shows an employment column outside the composition when it holds a value, but never an omitted one", () => {
    const employment = section(buildDetailSections(customer({ occupation: "Teacher", checkNumber: "12345" }), publicServant), "employment");
    expect(labels(employment)).toContain("Occupation");
    expect(labels(employment)).not.toContain("Check Number");
  });

  it("hides Place of Employment / Monthly Income when the type omits them, even with stored values", () => {
    const omitting: CustomerType = { ...publicServant, omittedStandardFields: ["place_of_employment", "monthly_income"] };
    const sections = buildDetailSections(customer({ placeOfEmployment: "Dodoma", monthlyIncome: 500000 }), omitting);
    const all = sections.flatMap((item) => labels(item));
    expect(all).not.toContain("Place of Employment");
    expect(all).not.toContain("Monthly Income");
  });

  it("renders Employment / Business only when relevant", () => {
    const none = buildDetailSections(customer(), business);
    expect(section(none, "employment")).toBeUndefined();
    expect(labels(section(none, "business"))).toEqual(["Business Name", "Business Type", "Business Address", "TIN Number", "Monthly Income"]);
    expect(section(buildDetailSections(customer(), publicServant), "business")).toBeUndefined();
    expect(labels(section(buildDetailSections(customer({ tinNumber: "123-456" }), publicServant), "business"))).toEqual(["TIN Number"]);
  });

  it("never lists the same column in two cards", () => {
    const sections = buildDetailSections(customer({ monthlyIncome: 100, occupation: "9", businessName: "Duka" }), publicServant);
    const keys = sections.filter((item) => ["type", "employment", "business"].includes(item.key)).flatMap((item) => item.items.map((row) => row.key));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("adds optional contact rows only when stored and links the KYC attachment", () => {
    const plain = section(buildDetailSections(customer(), undefined), "additional");
    expect(labels(plain)).not.toContain("Email");
    const filled = buildDetailSections(
      customer({ email: "a@b.tz", documents: [{ id: 4, documentType: "kyc_attachment", originalName: "id.png", downloadUrl: "customers/7/documents/4/download" } as never] }),
      undefined,
    );
    expect(labels(section(filled, "additional"))).toContain("Email");
    expect(section(filled, "kyc")?.items.find((item) => item.key === "kycAttachment")).toMatchObject({ kind: "link", href: "customers/7/documents/4/download" });
  });

  it("shows only the account rows of the chosen method", () => {
    expect(labels(section(buildDetailSections(customer({ paymentMethod: "mno" }), undefined), "account"))).toEqual(["Account Type", "MNO Provider", "Account name", "Phone / Wallet Number"]);
    expect(labels(section(buildDetailSections(customer({ paymentMethod: "bank" }), undefined), "account"))).toEqual(["Account Type", "Bank", "Bank Branch", "Account name", "Account number"]);
  });
});

describe("groupTypeFields", () => {
  it("returns nothing without a type", () => {
    expect(groupTypeFields(customer(), undefined)).toMatchObject({ typeFields: [], employment: [], business: [] });
  });
});

const scan = (overrides: Partial<FaceScanResource> = {}): FaceScanResource => ({
  id: 3,
  customerId: 7,
  status: "passed",
  qualityScore: 90,
  brightnessScore: 80,
  blurScore: 85,
  distanceScore: 88,
  centeringScore: 92,
  eyesOpenScore: 95,
  scannerVersion: "v1",
  livenessPassed: true,
  poseSequenceCompleted: true,
  checks: { oneFaceDetected: true, eyesOpen: true, centered: true, correctDistance: true, goodLighting: false, sharpImage: true, poseStraight: true, poseLeft: true, poseRight: true, poseUp: true },
  captureDevice: null,
  captureResolution: "1280x720",
  captureDurationMs: 9000,
  reason: null,
  scannedById: 1,
  scannedByName: "OFFICER",
  scannedAt: "2026-09-13T16:21:33+00:00",
  isActive: false,
  imageUrl: "customers/7/face-scans/3/image",
  ...overrides,
});

describe("face KYC helpers", () => {
  it("lists the eleven stored checks, unknown when not stored", () => {
    const rows = faceChecklist(scan());
    expect(rows).toHaveLength(11);
    expect(rows.find((row) => row.key === "goodLighting")?.passed).toBe(false);
    expect(rows.find((row) => row.key === "poseDown")?.passed).toBeNull();
  });

  it("pairs each image-quality score with its check", () => {
    expect(imageQualityMeters(scan()).map((meter) => [meter.label, meter.score, meter.passed])).toEqual([
      ["Lighting", 80, false],
      ["Distance", 88, true],
      ["Centering", 92, true],
      ["Sharpness", 85, true],
      ["Eyes Open", 95, true],
    ]);
  });

  it("features the active scan, else the latest", () => {
    expect(featuredScan([])).toBeNull();
    expect(featuredScan([scan({ id: 9 }), scan({ id: 8, isActive: true })])?.id).toBe(8);
    expect(featuredScan([scan({ id: 9 }), scan({ id: 8 })])?.id).toBe(9);
  });

  it("formats durations and builds the audit record from stored values only", () => {
    expect(formatDuration(9000)).toBe("9.0 s");
    expect(formatDuration(null)).toBe("");
    const record = faceAuditRecord(customer(), scan(), "2026-09-14T00:00:00Z");
    expect(record.scan).toMatchObject({ id: 3, captureDevice: null, ipAddress: null, qualityScore: 90 });
    expect(record.customer.customerNumber).toBe("CU-000007");
  });
});
