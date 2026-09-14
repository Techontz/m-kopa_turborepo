/**
 * Details tab: groups the customer's stored values into titled cards. Pure — the component only resolves select
 * labels (master data / parented lookups) and renders.
 *
 * Step 2 answers follow the customer type's configuration through `composeStep2Fields` (read-only): a field
 * removed from the type disappears from the type card, and standard fields are split into Employment / Business.
 */
import type { BadgeTone } from "@/components/ui/Badge";

import type { Customer, CustomerType, FaceScanResource, FieldDef, MasterData, MasterRow } from "../types";
import { BUSINESS_BLOCK, composeStep2Fields } from "../wizard/composition";

export type DetailItem =
  | { kind: "field"; key: string; label: string; field: FieldDef }
  | { kind: "text"; key: string; label: string; value: string | number | null | undefined; format?: "datetime" }
  | { kind: "badge"; key: string; label: string; value: string; tone: BadgeTone }
  | { kind: "link"; key: string; label: string; value: string; href: string };

export interface DetailSection {
  key: "basic" | "additional" | "type" | "employment" | "business" | "account" | "kyc" | "face";
  title: string;
  items: DetailItem[];
  /** Half-width card on wide screens. */
  compact?: boolean;
}

export const titleCase = (value: string | null | undefined) => (value ? value.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()) : "");

export const nameOf = (rows: MasterRow[] | undefined, id: number | string | null | undefined) =>
  id === null || id === undefined || id === "" ? "" : (rows?.find((row) => String(row.id) === String(id))?.name ?? String(id));

/** Raw stored value of a Step 2 field: its column when it `storesIn` one, else the dynamic answer. */
export function rawFieldValue(customer: Customer, field: FieldDef): string {
  const raw = field.storesIn ? (customer as unknown as Record<string, unknown>)[field.storesIn] : customer.dynamicFormData?.[field.key];
  return raw === null || raw === undefined ? "" : String(raw);
}

const hasText = (value: unknown) => value !== null && value !== undefined && String(value).trim() !== "";

const field = (key: string, label: string, storesIn: string, type: FieldDef["type"] = "text", dataSource?: string, dependsOn?: string): FieldDef => ({
  key,
  label,
  type,
  storesIn,
  ...(dataSource ? { dataSource } : {}),
  ...(dependsOn ? { dependsOn } : {}),
});

/** Every employment column, with the same labels the registration form uses. */
const EMPLOYMENT_FIELDS: FieldDef[] = [
  field("sector_id", "Sector", "sectorId", "select", "sectors"),
  field("sector_category_id", "Cadre", "sectorCategoryId", "select", "sector-categories", "sector_id"),
  field("employer_id", "Employer", "employerId", "select", "employers"),
  field("employer", "Employer", "employer"),
  field("place_of_employment", "Place of Employment", "placeOfEmployment"),
  field("check_number", "Check Number", "checkNumber"),
  field("occupation", "Occupation", "occupation"),
  field("department", "Department", "department"),
  field("council_number", "Council Number", "councilNumber"),
  field("employment_type", "Employment Type", "employmentType"),
  field("work_type", "Work Type", "workType"),
  field("contract_type_id", "Contract Type", "contractTypeId", "select", "contract-types"),
  field("contract_expiry_date", "Contract Expiry Date", "contractExpiryDate", "date"),
  field("basic_salary", "Basic Salary", "basicSalary", "currency"),
  field("take_home", "Take Home", "takeHome", "currency"),
  field("monthly_income", "Monthly Income", "monthlyIncome", "currency"),
  field("retirement_date", "Date of Retirement", "retirementDate", "date"),
];

const BUSINESS_FIELDS: FieldDef[] = BUSINESS_BLOCK.map((item) => ({ ...item, label: item.label.replace(/\s*\(Optional\)$/i, "") }));

const EMPLOYMENT_COLUMNS = new Set(EMPLOYMENT_FIELDS.map((item) => item.storesIn));
const BUSINESS_COLUMNS = new Set(BUSINESS_FIELDS.map((item) => item.storesIn));

const asItem = (item: FieldDef): DetailItem => ({ kind: "field", key: item.storesIn ?? item.key, label: item.label.replace(/\s*\(Optional\)$/i, ""), field: item });

/** Which card a composed standard field belongs to. */
function cardFor(item: FieldDef, type: CustomerType): "employment" | "business" | "type" {
  const column = item.storesIn ?? "";
  if (EMPLOYMENT_COLUMNS.has(column) && BUSINESS_COLUMNS.has(column)) {
    return type.sector === "business" ? "business" : type.sector === "employment" ? "employment" : "type";
  }
  if (BUSINESS_COLUMNS.has(column)) {
    return "business";
  }
  if (EMPLOYMENT_COLUMNS.has(column)) {
    return "employment";
  }
  return "type";
}

export interface TypeGroups {
  typeTitle: string;
  typeFields: FieldDef[];
  employment: FieldDef[];
  business: FieldDef[];
}

/**
 * Type card = configured fields (in order) + standard fields outside Employment/Business.
 * Employment/Business = composed standard fields, plus any other non-omitted column of that group that holds a value.
 */
export function groupTypeFields(customer: Customer, type: CustomerType | null | undefined): TypeGroups {
  const composed = composeStep2Fields(type);
  const groups: TypeGroups = {
    typeTitle: (type?.formTitle || (type ? `Taarifa za ${type.name}` : "Customer Type Details")).toUpperCase(),
    typeFields: [],
    employment: [],
    business: [],
  };
  const usedColumns = new Set<string>();

  for (const item of composed) {
    if (item.storesIn) {
      usedColumns.add(item.storesIn);
    }
    if (item.origin === "configured" || !type) {
      groups.typeFields.push(item);
      continue;
    }
    const card = cardFor(item, type);
    (card === "type" ? groups.typeFields : groups[card]).push(item);
  }

  // Standard fields the type omits stay hidden even when an old value is stored.
  const omitted = new Set(Array.isArray(type?.omittedStandardFields) ? type.omittedStandardFields : []);
  const withValue = (candidates: FieldDef[]) => candidates.filter((item) => item.storesIn && !omitted.has(item.key) && !usedColumns.has(item.storesIn) && hasText(rawFieldValue(customer, item)));
  for (const item of withValue(BUSINESS_FIELDS.filter((candidate) => !(type?.sector !== "business" && EMPLOYMENT_COLUMNS.has(candidate.storesIn ?? ""))))) {
    usedColumns.add(item.storesIn as string);
    groups.business.push(item);
  }
  for (const item of withValue(EMPLOYMENT_FIELDS)) {
    usedColumns.add(item.storesIn as string);
    groups.employment.push(item);
  }

  return groups;
}

const APPROVAL_TONE: Record<string, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger", not_required: "default" };

export function paymentMethodLabel(method: Customer["paymentMethod"]): string {
  return method === "mno" ? "Mobile Money" : method === "bank" ? "Bank Account" : "";
}

/** Face verification summary drawn from the customer record and (when loaded) the active scan. */
export function faceSummaryItems(customer: Customer, activeScan: FaceScanResource | null | undefined): DetailItem[] {
  const status = customer.faceVerifiedAt ? { value: "Verified", tone: "success" as BadgeTone } : customer.faceScanStatus === "failed" ? { value: "Failed", tone: "danger" as BadgeTone } : { value: "Not verified", tone: "warning" as BadgeTone };
  const items: DetailItem[] = [{ kind: "badge", key: "faceStatus", label: "Face Status", ...status }];
  items.push(
    activeScan
      ? { kind: "badge", key: "liveness", label: "Liveness", value: activeScan.livenessPassed ? "Passed" : "Failed", tone: activeScan.livenessPassed ? "success" : "danger" }
      : { kind: "text", key: "liveness", label: "Liveness", value: null },
  );
  items.push({ kind: "text", key: "faceQuality", label: "Quality Score", value: customer.faceScanQuality === null || customer.faceScanQuality === undefined ? null : `${customer.faceScanQuality}/100` });
  items.push({ kind: "text", key: "faceDate", label: "Verification Date", value: customer.faceVerifiedAt ?? customer.faceScannedAt, format: "datetime" });
  return items;
}

export interface BuildOptions {
  masterData?: MasterData;
  activeScan?: FaceScanResource | null;
}

/** Ordered cards for the Details tab; optional cards are left out when they hold nothing for this customer. */
export function buildDetailSections(customer: Customer, type: CustomerType | null | undefined, options: BuildOptions = {}): DetailSection[] {
  const { masterData } = options;
  const text = (key: string, label: string, value: string | number | null | undefined): DetailItem => ({ kind: "text", key, label, value });
  const optional = (key: string, label: string, value: string | number | null | undefined): DetailItem[] => (hasText(value) ? [text(key, label, value)] : []);
  const method = customer.paymentMethod;

  const basic: DetailSection = {
    key: "basic",
    title: "Basic Information",
    items: [
      text("customerNumber", "Customer number", customer.customerNumber),
      text("firstName", "First Name", customer.firstName),
      text("middleName", "Middle name", customer.middleName),
      text("lastName", "Last name", customer.lastName),
      text("gender", "Gender", titleCase(customer.gender)),
      text("dob", "Date of Birth", customer.dob),
      text("age", "Age", customer.age),
      text("phone", "Phone Number", customer.phone),
      text("customerType", "Customer Type", customer.categoryName ?? type?.name),
      text("branch", "Branch", customer.branchName),
      text("officer", "Assigned Officer", customer.employeeName),
    ],
  };

  const additional: DetailSection = {
    key: "additional",
    title: "Additional Details",
    items: [
      text("maritalStatus", "Marital Status", nameOf(masterData?.["marital-statuses"], customer.maritalStatusId) || titleCase(customer.maritalStatus)),
      text("dependents", "Number of Dependents", customer.dependentsCount),
      text("residenceType", "Residence Type", titleCase(customer.residenceType)),
      text("region", "Region", customer.regionName),
      text("district", "District", customer.districtName),
      text("ward", "Ward", customer.wardName),
      text("street", "Street", customer.streetName),
      ...optional("village", "Village", customer.village),
      ...optional("houseNumber", "House Number", customer.houseNumber),
      ...optional("postalCode", "Postal Code", customer.postalCode),
      ...optional("landmark", "Landmark", customer.landmark),
      ...optional("alternativePhone", "Alternative Phone", customer.alternativePhone),
      ...optional("email", "Email", customer.email),
      ...optional("nationality", "Nationality", customer.nationality),
    ],
  };

  const groups = groupTypeFields(customer, type);
  const sections: DetailSection[] = [basic, additional];
  if (groups.typeFields.length > 0) {
    sections.push({ key: "type", title: groups.typeTitle, items: groups.typeFields.map(asItem) });
  }
  if (groups.employment.length > 0) {
    sections.push({ key: "employment", title: "Employment", items: groups.employment.map(asItem), compact: true });
  }
  if (groups.business.length > 0) {
    sections.push({ key: "business", title: "Business", items: groups.business.map(asItem), compact: true });
  }

  const showBank = method !== "mno" || hasText(customer.bankId) || hasText(customer.bankName) || hasText(customer.bankBranch) || hasText(customer.accountNumber);
  const showMno = method !== "bank" || hasText(customer.mobileMoneyProviderId) || hasText(customer.mobileMoneyProvider) || hasText(customer.walletNumber);
  sections.push({
    key: "account",
    title: "Account Information",
    compact: true,
    items: [
      text("accountType", "Account Type", paymentMethodLabel(method)),
      ...(showBank
        ? [
            text("bank", "Bank", customer.bankName ?? nameOf(masterData?.banks, customer.bankId)),
            text("bankBranch", "Bank Branch", customer.bankBranch),
          ]
        : []),
      ...(showMno ? [text("mno", "MNO Provider", customer.mobileMoneyProvider ?? nameOf(masterData?.["mobile-money-providers"], customer.mobileMoneyProviderId))] : []),
      text("accountName", "Account name", customer.accountName),
      ...(showBank ? [text("accountNumber", "Account number", customer.accountNumber)] : []),
      ...(showMno ? [text("wallet", "Phone / Wallet Number", customer.walletNumber)] : []),
      ...(customer.cardLastFour ? [text("card", "Card", `•••• ${customer.cardLastFour}`)] : []),
    ],
  });

  const attachment = (customer.documents ?? []).find((document) => document.documentType === "kyc_attachment");
  const approvalTone = APPROVAL_TONE[customer.approvalStatus] ?? "default";
  sections.push({
    key: "kyc",
    title: "KYC Information",
    compact: true,
    items: [
      { kind: "badge", key: "kycStatus", label: "KYC Status", value: customer.kycStatus === "completed" ? "Complete" : "Incomplete", tone: customer.kycStatus === "completed" ? "success" : "warning" },
      attachment
        ? { kind: "link", key: "kycAttachment", label: "KYC Attachment", value: attachment.originalName, href: attachment.downloadUrl ?? `customers/${customer.id}/documents/${attachment.id}/download` }
        : text("kycAttachment", "KYC Attachment", null),
      text("idType", "ID Type", customer.idTypeName ?? nameOf(masterData?.["id-types"], customer.idTypeId)),
      text("idNumber", "ID Number", customer.idNumber),
      ...optional("nidaNumber", "NIDA Number", customer.nidaNumber),
      ...optional("nationalIdNumber", "National ID Number", customer.nationalIdNumber),
      ...optional("voterIdNumber", "Voter ID Number", customer.voterIdNumber),
      ...optional("driverLicenceNumber", "Driver's Licence Number", customer.driverLicenceNumber),
      ...optional("passportNumber", "Passport Number", customer.passportNumber),
      ...optional("workIdNumber", "Work ID Number", customer.workIdNumber),
      { kind: "badge", key: "nida", label: "NIDA verified", value: customer.nidaVerifiedAt ? "Verified" : "Not verified", tone: customer.nidaVerifiedAt ? "success" : "default" },
      { kind: "badge", key: "otp", label: "OTP verified", value: customer.otpVerifiedAt ? "Verified" : "Not verified", tone: customer.otpVerifiedAt ? "success" : "default" },
      hasText(customer.approvalStatus) ? { kind: "badge", key: "approval", label: "Approval", value: titleCase(customer.approvalStatus), tone: approvalTone } : text("approval", "Approval", null),
      ...(customer.approvedAt ? [{ kind: "text" as const, key: "approvedAt", label: "Approved", value: customer.approvedAt, format: "datetime" as const }] : []),
      ...optional("rejectionReason", "Rejection reason", customer.rejectionReason),
    ],
  });

  sections.push({ key: "face", title: "Face Verification", compact: true, items: faceSummaryItems(customer, options.activeScan) });

  return sections;
}

/* ----------------------------------------------------------------- Face KYC ----------------------------------------------------------------- */

/** The eleven stored checks (FaceScan::CHECKS) in the order the Face KYC checklist shows them. */
export const FACE_CHECKLIST: Array<{ key: keyof FaceScanResource["checks"] & string; label: string }> = [
  { key: "oneFaceDetected", label: "One Face Detected" },
  { key: "correctDistance", label: "Correct Distance" },
  { key: "goodLighting", label: "Good Lighting" },
  { key: "poseStraight", label: "Straight Pose" },
  { key: "poseUp", label: "Up Pose" },
  { key: "poseLeft", label: "Left Pose" },
  { key: "poseDown", label: "Down Pose" },
  { key: "poseRight", label: "Right Pose" },
  { key: "eyesOpen", label: "Eyes Open" },
  { key: "centered", label: "Centered in Frame" },
  { key: "sharpImage", label: "Sharp Image" },
];

export interface QualityMeter {
  key: string;
  label: string;
  score: number | null;
  passed: boolean | null;
}

/** Image quality meters: each stored 0–100 score with the pass/fail of its matching check. */
export function imageQualityMeters(scan: FaceScanResource): QualityMeter[] {
  const check = (key: string) => {
    const value = (scan.checks as Record<string, boolean | undefined>)?.[key];
    return value === undefined ? null : Boolean(value);
  };
  const num = (value: number | null | undefined) => (value === null || value === undefined || Number.isNaN(Number(value)) ? null : Math.max(0, Math.min(100, Number(value))));
  return [
    { key: "lighting", label: "Lighting", score: num(scan.brightnessScore), passed: check("goodLighting") },
    { key: "distance", label: "Distance", score: num(scan.distanceScore), passed: check("correctDistance") },
    { key: "centering", label: "Centering", score: num(scan.centeringScore), passed: check("centered") },
    { key: "sharpness", label: "Sharpness", score: num(scan.blurScore), passed: check("sharpImage") },
    { key: "eyesOpen", label: "Eyes Open", score: num(scan.eyesOpenScore), passed: check("eyesOpen") },
  ];
}

/** Checklist rows; a check the scan did not store is `null` (shown as "—"). */
export function faceChecklist(scan: FaceScanResource): Array<{ key: string; label: string; passed: boolean | null }> {
  return FACE_CHECKLIST.map((item) => {
    const value = (scan.checks as Record<string, boolean | undefined>)?.[item.key];
    return { ...item, passed: value === undefined ? null : Boolean(value) };
  });
}

/** The scan to feature: the active one, else the most recent. */
export function featuredScan(scans: FaceScanResource[] | undefined): FaceScanResource | null {
  if (!scans || scans.length === 0) {
    return null;
  }
  return scans.find((scan) => scan.isActive) ?? scans[0];
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) {
    return "";
  }
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/** Tone for a 0–100 score bar. */
export function scoreTone(score: number | null): "success" | "warning" | "danger" | "default" {
  if (score === null) {
    return "default";
  }
  return score >= 70 ? "success" : score >= 40 ? "warning" : "danger";
}

/** Audit record of one scan, exactly as stored — for the Download Audit button. */
export function faceAuditRecord(customer: Pick<Customer, "id" | "customerNumber" | "fullName">, scan: FaceScanResource, generatedAt: string) {
  return {
    generatedAt,
    customer: { id: customer.id, customerNumber: customer.customerNumber, fullName: customer.fullName },
    scan: {
      id: scan.id,
      status: scan.status,
      isActive: scan.isActive,
      scannedAt: scan.scannedAt,
      scannedById: scan.scannedById,
      scannedByName: scan.scannedByName,
      qualityScore: scan.qualityScore,
      scores: { brightness: scan.brightnessScore, blur: scan.blurScore, distance: scan.distanceScore, centering: scan.centeringScore, eyesOpen: scan.eyesOpenScore },
      livenessPassed: scan.livenessPassed,
      poseSequenceCompleted: scan.poseSequenceCompleted,
      checks: scan.checks,
      reason: scan.reason,
      scannerVersion: scan.scannerVersion,
      captureDevice: scan.captureDevice,
      captureResolution: scan.captureResolution,
      captureDurationMs: scan.captureDurationMs,
      ipAddress: scan.ipAddress ?? null,
      userAgent: scan.userAgent ?? null,
    },
  };
}
