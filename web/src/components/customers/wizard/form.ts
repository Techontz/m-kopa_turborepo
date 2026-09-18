/**
 * The registration wizard's single form state, its pure updaters (cascade clearing, payment switching,
 * customer type change), the POST /customers payload builder and the draft payload repair.
 */
import type { Customer, FieldDef } from "../types";
import { STEP2_COLUMNS, descendantsOf } from "./composition";

export const RELATIONSHIPS = ["spouse", "parent", "sibling", "relative", "friend", "colleague", "other"] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export type PaymentChoice = "none" | "mno" | "bank";
export type Step2Column = (typeof STEP2_COLUMNS)[number];

export interface NextOfKinRow {
  name: string;
  phone: string;
  relationship: Relationship;
  address: string;
}

export interface GuarantorRow {
  name: string;
  phone: string;
  nidaNumber: string;
  relationship: Relationship;
  address: string;
  occupation: string;
}

export type WizardForm = {
  branchId: number | null;
  employeeId: number | null;
  customerCategoryId: number | null;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: "" | "male" | "female";
  dob: string;
  phone: string;
  idTypeId: number | null;
  idNumber: string;
  maritalStatusId: number | null;
  dependentsCount: string;
  residenceType: "" | "owned" | "rented";
  regionId: number | null;
  districtId: number | null;
  wardId: number | null;
  wardName: string;
  /** "text" when the ward is typed instead of chosen from the list. */
  wardMode: "select" | "text";
  streetName: string;
  nextOfKin: NextOfKinRow[];
  dynamicFormData: Record<string, string>;
  paymentMethod: PaymentChoice;
  mobileMoneyProviderId: number | null;
  mobileMoneyProvider: string;
  walletNumber: string;
  bankId: number | null;
  bankName: string;
  bankBranch: string;
  accountName: string;
  accountNumber: string;
  guarantors: GuarantorRow[];
} & Record<Step2Column, string>;

export const ID_KEYS = [
  "branchId",
  "employeeId",
  "customerCategoryId",
  "idTypeId",
  "maritalStatusId",
  "regionId",
  "districtId",
  "wardId",
  "mobileMoneyProviderId",
  "bankId",
] as const;

const STRING_KEYS = [
  "firstName",
  "middleName",
  "lastName",
  "dob",
  "phone",
  "idNumber",
  "dependentsCount",
  "wardName",
  "streetName",
  "mobileMoneyProvider",
  "walletNumber",
  "bankName",
  "bankBranch",
  "accountName",
  "accountNumber",
  ...STEP2_COLUMNS,
] as const;

export function emptyForm(): WizardForm {
  const columns = Object.fromEntries(STEP2_COLUMNS.map((column) => [column, ""])) as Record<Step2Column, string>;
  return {
    branchId: null,
    employeeId: null,
    customerCategoryId: null,
    firstName: "",
    middleName: "",
    lastName: "",
    gender: "",
    dob: "",
    phone: "",
    idTypeId: null,
    idNumber: "",
    maritalStatusId: null,
    dependentsCount: "",
    residenceType: "",
    regionId: null,
    districtId: null,
    wardId: null,
    wardName: "",
    wardMode: "select",
    streetName: "",
    nextOfKin: [],
    dynamicFormData: {},
    paymentMethod: "none",
    mobileMoneyProviderId: null,
    mobileMoneyProvider: "",
    walletNumber: "",
    bankId: null,
    bankName: "",
    bankBranch: "",
    accountName: "",
    accountNumber: "",
    guarantors: [],
    ...columns,
  };
}

export function emptyNextOfKin(): NextOfKinRow {
  return { name: "", phone: "", relationship: "spouse", address: "" };
}

export function emptyGuarantor(): GuarantorRow {
  return { name: "", phone: "", nidaNumber: "", relationship: "spouse", address: "", occupation: "" };
}

/** Whole years since the date of birth, or null. Display only — never submitted. */
export function ageFrom(dob: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) {
    return null;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/* ------------------------------------------------------------------ answers ------------------------------------------------------------------ */

/** The current answer of a Step 2 field (column for `storesIn`, else dynamicFormData[key]). */
export function answerOf(form: WizardForm, field: FieldDef): string {
  if (field.storesIn && (STEP2_COLUMNS as readonly string[]).includes(field.storesIn)) {
    return form[field.storesIn as Step2Column] ?? "";
  }
  return form.dynamicFormData[field.key] ?? "";
}

function writeAnswer(form: WizardForm, field: FieldDef, value: string): WizardForm {
  if (field.storesIn && (STEP2_COLUMNS as readonly string[]).includes(field.storesIn)) {
    return { ...form, [field.storesIn]: value };
  }
  const answers = { ...form.dynamicFormData };
  if (value === "") {
    delete answers[field.key];
  } else {
    answers[field.key] = value;
  }
  return { ...form, dynamicFormData: answers };
}

/** Sets an answer; changing a parent clears every descendant (cascading selects). */
export function setAnswer(form: WizardForm, fields: FieldDef[], key: string, value: string): WizardForm {
  const field = fields.find((item) => item.key === key);
  if (!field) {
    return form;
  }
  const changed = answerOf(form, field) !== value;
  let next = writeAnswer(form, field, value);
  if (changed) {
    for (const child of descendantsOf(fields, key)) {
      next = writeAnswer(next, child, "");
    }
  }
  return next;
}

/** Changing Customer Type clears all answers to the previous type's questions (JSON and column-mapped). */
export function changeCustomerType(form: WizardForm, previousFields: FieldDef[], customerCategoryId: number | null): WizardForm {
  if (form.customerCategoryId === customerCategoryId) {
    return form;
  }
  const next: WizardForm = { ...form, customerCategoryId, dynamicFormData: {} };
  for (const field of previousFields) {
    if (field.storesIn && (STEP2_COLUMNS as readonly string[]).includes(field.storesIn)) {
      next[field.storesIn as Step2Column] = "";
    }
  }
  return next;
}

/* ---------------------------------------------------------------- geography ---------------------------------------------------------------- */

export function setRegion(form: WizardForm, regionId: number | null): WizardForm {
  if (form.regionId === regionId) {
    return form;
  }
  return { ...form, regionId, districtId: null, wardId: null, wardName: "", wardMode: "select", streetName: "" };
}

export function setDistrict(form: WizardForm, districtId: number | null): WizardForm {
  if (form.districtId === districtId) {
    return form;
  }
  return { ...form, districtId, wardId: null, wardName: "", wardMode: "select", streetName: "" };
}

/* ----------------------------------------------------------------- payment ----------------------------------------------------------------- */

const MNO_CLEARED = { mobileMoneyProviderId: null, mobileMoneyProvider: "", walletNumber: "" } as const;
const BANK_CLEARED = { bankId: null, bankName: "", bankBranch: "", accountName: "", accountNumber: "" } as const;

/** Switching kinds clears the other kind's values; clearing the chooser returns to "none". */
export function switchPaymentMethod(form: WizardForm, choice: PaymentChoice | null): WizardForm {
  const next = choice ?? "none";
  if (next === form.paymentMethod) {
    return form;
  }
  return {
    ...form,
    ...(next !== "mno" ? MNO_CLEARED : {}),
    ...(next !== "bank" ? BANK_CLEARED : {}),
    paymentMethod: next,
  };
}

/* ----------------------------------------------------------------- payload ----------------------------------------------------------------- */

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function numberOrNull(value: string | null | undefined): number | null {
  const trimmed = (value ?? "").toString().replace(/,/g, "").trim();
  if (trimmed === "") {
    return null;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

/** POST /customers body. Age is never sent; hidden payment values are never sent; "none" is null. */
export function buildRegistrationPayload(form: WizardForm, fields: FieldDef[]): Record<string, unknown> {
  const dynamicFormData: Record<string, string> = {};
  const columns: Record<string, string | number | null> = {};

  for (const field of fields) {
    const value = answerOf(form, field);
    if (field.storesIn) {
      columns[field.storesIn] = field.type === "number" || field.type === "currency" ? numberOrNull(value) : textOrNull(value);
    } else if (textOrNull(value) !== null) {
      dynamicFormData[field.key] = value.trim();
    }
  }

  const payment = form.paymentMethod;

  return {
    branchId: form.branchId,
    employeeId: form.employeeId,
    customerCategoryId: form.customerCategoryId,
    firstName: form.firstName.trim(),
    middleName: textOrNull(form.middleName),
    lastName: form.lastName.trim(),
    dob: form.dob,
    gender: form.gender || null,
    phone: form.phone.trim(),
    idTypeId: form.idTypeId,
    idNumber: textOrNull(form.idNumber),
    maritalStatusId: form.maritalStatusId,
    dependentsCount: form.dependentsCount.trim() === "" ? null : Number(form.dependentsCount),
    residenceType: form.residenceType || null,
    regionId: form.regionId,
    districtId: form.districtId,
    wardId: form.wardMode === "text" ? null : form.wardId,
    wardName: textOrNull(form.wardName),
    streetName: textOrNull(form.streetName),
    ...columns,
    dynamicFormData,
    paymentMethod: payment === "none" ? null : payment,
    mobileMoneyProviderId: payment === "mno" ? form.mobileMoneyProviderId : null,
    mobileMoneyProvider: payment === "mno" ? textOrNull(form.mobileMoneyProvider) : null,
    walletNumber: payment === "mno" ? textOrNull(form.walletNumber) : null,
    bankId: payment === "bank" ? form.bankId : null,
    bankBranch: payment === "bank" ? textOrNull(form.bankBranch) : null,
    accountName: payment === "bank" ? textOrNull(form.accountName) : null,
    bankDetails:
      payment === "bank"
        ? { bankName: textOrNull(form.bankName), accountNumber: textOrNull(form.accountNumber), accountName: textOrNull(form.accountName), phoneNumber: textOrNull(form.phone) }
        : null,
    nextOfKin: form.nextOfKin.map((row) => ({ name: row.name.trim(), relationship: row.relationship, phone: row.phone.trim(), address: textOrNull(row.address) })),
    guarantors: form.guarantors.map((row) => ({
      name: row.name.trim(),
      phone: row.phone.trim(),
      nidaNumber: textOrNull(row.nidaNumber),
      relationship: row.relationship,
      address: textOrNull(row.address),
      occupation: textOrNull(row.occupation),
    })),
    nidaVerifiedAt: null,
    otpVerifiedAt: null,
    faceVerifiedAt: null,
  };
}

/** Draft label: first + last name, else the phone, else "Unnamed registration" (≤160). */
export function draftLabel(form: Pick<WizardForm, "firstName" | "lastName" | "phone">): string {
  const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
  return (name || form.phone.trim() || "Unnamed registration").slice(0, 160);
}

/** True when the form holds anything worth keeping. */
export function isFormEmpty(form: WizardForm): boolean {
  return JSON.stringify(form) === JSON.stringify(emptyForm());
}

/* ------------------------------------------------------------------ repair ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toId(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string" && /^\s*\d+\s*$/.test(value)) {
    const number = Number(value);
    return number > 0 ? number : null;
  }
  return null;
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return "";
}

function toRelationship(value: unknown): Relationship {
  const text = toText(value).toLowerCase();
  return (RELATIONSHIPS as readonly string[]).includes(text) ? (text as Relationship) : "other";
}

function toList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (isRecord(value)) {
    const entries = Object.values(value);
    // An object keyed "0","1",… (PHP-style list) or a single row.
    return entries.length > 0 && entries.every(isRecord) ? (entries as Record<string, unknown>[]) : [value];
  }
  return [];
}

function joinName(row: Record<string, unknown>): string {
  const direct = toText(row.name ?? row.fullName ?? row.full_name);
  if (direct) {
    return direct;
  }
  return [row.firstName ?? row.first_name, row.middleName ?? row.middle_name, row.lastName ?? row.last_name].map(toText).filter(Boolean).join(" ");
}

function toAnswers(value: unknown): Record<string, string> {
  const answers: Record<string, string> = {};
  if (Array.isArray(value)) {
    for (const item of value) {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] === "string") {
        answers[item[0]] = toText(item[1]);
      } else if (isRecord(item) && typeof item.key === "string") {
        answers[item.key] = toText(item.value);
      }
    }
  } else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      answers[key] = Array.isArray(item) ? item.map(toText).join(", ") : toText(item);
    }
  }
  return Object.fromEntries(Object.entries(answers).filter(([, item]) => item !== ""));
}

/**
 * Repairs a saved draft payload (including older shapes) into the current form:
 * numbers coerced, answers normalised to an object, list fields made arrays, payment choice inferred.
 */
export function repairDraftPayload(raw: unknown): WizardForm {
  const form = emptyForm();
  const source: Record<string, unknown> = isRecord(raw) ? (isRecord(raw.form) ? raw.form : raw) : {};

  for (const key of ID_KEYS) {
    form[key] = toId(source[key]);
  }
  for (const key of STRING_KEYS) {
    form[key] = toText(source[key]);
  }

  const gender = toText(source.gender).toLowerCase();
  form.gender = gender === "male" || gender === "female" ? gender : "";
  const residence = toText(source.residenceType).toLowerCase();
  form.residenceType = residence === "owned" || residence === "rented" ? residence : "";

  form.dynamicFormData = toAnswers(source.dynamicFormData);

  form.nextOfKin = toList(source.nextOfKin).map((row) => ({
    name: joinName(row),
    phone: toText(row.phone ?? row.phoneNumber),
    relationship: toRelationship(row.relationship ?? "spouse"),
    address: toText(row.address),
  }));

  form.guarantors = toList(source.guarantors).map((row) => ({
    name: joinName(row),
    phone: toText(row.phone ?? row.phoneNumber),
    nidaNumber: toText(row.nidaNumber ?? row.nida_number ?? row.idNumber),
    relationship: toRelationship(row.relationship ?? "spouse"),
    address: toText(row.address),
    occupation: toText(row.occupation),
  }));

  const bankDetails = isRecord(source.bankDetails) ? source.bankDetails : null;
  if (bankDetails) {
    form.accountNumber ||= toText(bankDetails.accountNumber);
    form.bankName ||= toText(bankDetails.bankName);
    form.accountName ||= toText(bankDetails.accountName);
  }

  const declared = toText(source.paymentMethod).toLowerCase();
  if (declared === "mno" || declared === "bank" || declared === "none") {
    form.paymentMethod = declared;
  } else if (form.walletNumber || form.mobileMoneyProviderId) {
    form.paymentMethod = "mno";
  } else if (form.accountNumber || form.bankId) {
    form.paymentMethod = "bank";
  } else {
    form.paymentMethod = "none";
  }
  // Never keep the hidden kind's values.
  const choice = form.paymentMethod;
  Object.assign(form, choice !== "mno" ? MNO_CLEARED : {}, choice !== "bank" ? BANK_CLEARED : {});

  form.wardMode = source.wardMode === "text" || (form.wardId === null && form.wardName !== "") ? "text" : "select";

  return form;
}

/* ------------------------------------------------------------------ edit ------------------------------------------------------------------ */

/**
 * The wizard form for editing an existing customer. The customer resource uses the registration payload's names, so
 * it goes through the same repair as a draft; the stored gender ("M", "Female") is normalised on the way in.
 */
export function formFromCustomer(customer: Customer): WizardForm {
  const gender = (customer.gender ?? "").trim().toLowerCase();
  return repairDraftPayload({
    ...customer,
    gender: gender.startsWith("f") ? "female" : gender.startsWith("m") ? "male" : "",
    idNumber: customer.idNumber ?? customer.nidaNumber,
    nextOfKin: customer.nextOfKin ?? [],
    guarantors: customer.guarantors ?? [],
  });
}

/**
 * The PUT /customers/{id} body: only the top-level payload keys whose value differs from the customer as loaded, so
 * an old record with gaps can be corrected one field at a time. Verification stamps are never sent from an edit.
 */
export function changedPayload(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, unknown> {
  const locked = new Set(["nidaVerifiedAt", "otpVerifiedAt", "faceVerifiedAt"]);
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => !locked.has(key) && JSON.stringify(value ?? null) !== JSON.stringify(before[key] ?? null)));
}

/**
 * Keeps the validation errors about what an edit changes ("guarantors.0.phone" belongs to "guarantors"); a changed
 * customer type re-checks everything, as the API does.
 */
export function errorsForChanges<T>(errors: Record<string, T>, changed: Record<string, unknown>): Record<string, T> {
  if ("customerCategoryId" in changed) {
    return errors;
  }
  return Object.fromEntries(Object.entries(errors).filter(([key]) => key.split(".")[0] in changed));
}

/** Saved draft step (0-based) clamped to at most Step 3. */
export function resumeStep(step: unknown): number {
  const number = Math.trunc(Number(step));
  return Number.isFinite(number) ? Math.min(Math.max(number, 0), 2) : 0;
}
