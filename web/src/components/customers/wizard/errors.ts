/**
 * Maps validation error keys (client or server 422) to the wizard step that owns the field, and builds the
 * toast that names the failing fields (CUSTOMER_MODULE_SPEC §2.3).
 */
import type { FieldDef } from "../types";
import { fieldErrorKey, type Errors } from "./validation";

const STEP1_FIELDS = new Set([
  "firstName",
  "middleName",
  "lastName",
  "dob",
  "gender",
  "phone",
  "maritalStatusId",
  "maritalStatus",
  "branchId",
  "employeeId",
  "idTypeId",
  "idNumber",
  "nidaNumber",
  "nationalIdNumber",
  "voterIdNumber",
  "driverLicenceNumber",
  "passportNumber",
  "workIdNumber",
  "regionId",
  "districtId",
  "wardId",
  "wardName",
  "streetId",
  "streetName",
  "residenceType",
  "alternativePhone",
  "email",
  "nationality",
  "dependentsCount",
  "customerCategoryId",
  "nextOfKin",
]);

const STEP3_PREFIXES = ["documents", "attachments", "customerDocuments", "file"];

/** 0-based step index (0 = Basic Information, 1 = Customer Details, 2 = KYC Attachments). */
export function stepForErrorKey(key: string): 0 | 1 | 2 {
  const root = key.split(/[.[]/)[0];
  if (STEP1_FIELDS.has(root)) {
    return 0;
  }
  if (STEP3_PREFIXES.some((prefix) => root === prefix || root.startsWith(prefix))) {
    return 2;
  }
  return 1;
}

/** Flattens a Laravel error bag ({field: [messages]}) to {field: firstMessage}. */
export function flattenServerErrors(errors: Record<string, string[] | string> | null | undefined): Errors {
  const flat: Errors = {};
  for (const [key, messages] of Object.entries(errors ?? {})) {
    const first = Array.isArray(messages) ? messages[0] : messages;
    if (first) {
      flat[key] = first;
    }
  }
  return flat;
}

/** The earliest step holding an error, or null. */
export function firstErrorStep(errors: Errors): 0 | 1 | 2 | null {
  const steps = Object.keys(errors).map(stepForErrorKey);
  return steps.length === 0 ? null : (Math.min(...steps) as 0 | 1 | 2);
}

const STATIC_LABELS: Record<string, string> = {
  branchId: "Branch",
  employeeId: "Assigned Officer",
  customerCategoryId: "Customer Type",
  firstName: "First Name",
  middleName: "Middle name",
  lastName: "Last name",
  gender: "Gender",
  dob: "Date of Birth",
  phone: "Phone Number",
  idTypeId: "ID Type",
  idNumber: "ID Number",
  nidaNumber: "NIDA Number",
  nationalIdNumber: "National ID Number",
  voterIdNumber: "Voter ID Number",
  driverLicenceNumber: "Driver's Licence Number",
  passportNumber: "Passport Number",
  workIdNumber: "Work ID Number",
  maritalStatusId: "Marital Status",
  maritalStatus: "Marital Status",
  dependentsCount: "Number of Dependents",
  residenceType: "Residence Type",
  regionId: "Region",
  districtId: "District",
  wardId: "Ward",
  wardName: "Ward",
  streetName: "Street",
  alternativePhone: "Alternative Phone",
  email: "Email",
  nationality: "Nationality",
  nextOfKin: "Next of Kin",
  guarantors: "Guarantors",
  employer: "Employer",
  workType: "Work type",
  paymentMethod: "Account Number",
  mobileMoneyProviderId: "MNO Provider",
  mobileMoneyProvider: "MNO Provider",
  walletNumber: "Phone / Wallet Number",
  bankId: "Bank",
  bankBranch: "Bank Branch",
  accountName: "Account Name",
  "bankDetails.accountNumber": "Account Number",
  "bankDetails.accountName": "Account Name",
  "bankDetails.bankName": "Bank",
  cardNumber: "Card details",
  file: "KYC Attachment",
  documents: "KYC Attachment",
};

const ROW_LABELS: Record<string, string> = { name: "Full Name", phone: "Phone", relationship: "Relationship", address: "Address", nidaNumber: "NIDA Number", occupation: "Occupation" };

/** Human label of an error key, using the composed Step 2 fields for type questions. */
export function labelForErrorKey(key: string, fields: FieldDef[] = []): string {
  const composed = fields.find((field) => fieldErrorKey(field) === key || `dynamicFormData.${field.key}` === key);
  if (composed) {
    return composed.label;
  }
  if (STATIC_LABELS[key]) {
    return STATIC_LABELS[key];
  }
  const row = /^(nextOfKin|guarantors)\.(\d+)\.(\w+)$/.exec(key);
  if (row) {
    const owner = row[1] === "nextOfKin" ? "Next of kin" : "Guarantor";
    return `${owner} ${Number(row[2]) + 1} ${(ROW_LABELS[row[3]] ?? row[3]).toLowerCase()}`;
  }
  if (key.startsWith("documents") || key.startsWith("attachments") || key.startsWith("customerDocuments") || key.startsWith("file")) {
    return "KYC Attachment";
  }
  const tail = key.replace(/^dynamicFormData\./, "").split(".").pop() ?? key;
  return tail.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (letter) => letter.toUpperCase());
}

/** "Check First Name, Phone Number and Region." / "Check A, B, C +2 more." */
export function errorToast(errors: Errors, fields: FieldDef[] = []): string {
  const labels = [...new Set(Object.keys(errors).map((key) => labelForErrorKey(key, fields)))];
  if (labels.length === 0) {
    return "";
  }
  const shown = labels.slice(0, 3);
  const more = labels.length - shown.length;
  const list = more > 0 ? `${shown.join(", ")} +${more} more` : shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
  return `Please check ${list}.`;
}

/** DOM id used for a field's control so the wizard can focus the first failing field. */
export function fieldDomId(key: string): string {
  return `cr-${key.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}
