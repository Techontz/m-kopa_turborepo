/**
 * Client-side checks run on Save & Continue / Complete Registration. Same rules and wording as the server
 * (CUSTOMER_MODULE_SPEC §3.5, §4.3, §5, §6; IMPLEMENTATION §5), keyed by the payload field name so each
 * message lands on the field and on the step that shows it.
 */
import type { FieldDef, RequirementProfile } from "../types";
import { answerOf, type WizardForm } from "./form";

export type Errors = Record<string, string>;

export const MESSAGES = {
  dobRequired: "Date of birth is required.",
  dobPast: "Date of birth must be in the past.",
  customerType: "A customer type is required for this account type — it decides which loan products the customer may take.",
  maritalStatus: "Marital status is required for this account type.",
  identity: "An identity document is required — choose the ID type and enter the number shown on it.",
  region: "Region is required.",
  district: "District must be selected.",
  employer: "An employer or place of employment is required for this account type.",
  workType: "Work type or type of employment is required for this account type.",
  income: "An income figure is required for this account type.",
  businessName: "Business name is required for this account type.",
  businessType: "Business type is required for this account type.",
  mnoProvider: "Choose the mobile money provider.",
  wallet: "Enter the number the wallet is registered on.",
  bank: "Choose the bank.",
  accountName: "Enter the name the account is held in.",
  accountNumber: "Enter the account number.",
  paymentRequired: "A bank account or a mobile money wallet number is required for this account type.",
  attachment: "Attach the customer's KYC documents before saving.",
} as const;

export function nextOfKinMinimum(min: number): string {
  return min === 1 ? `At least ${min} next of kin is required for this account type.` : `At least ${min} next of kin are required for this account type.`;
}

export function guarantorMinimum(min: number): string {
  return min === 1 ? `At least ${min} guarantor is required for this account type.` : `At least ${min} guarantors are required for this account type.`;
}

export function requiredMessage(label: string): string {
  return `${label} is required.`;
}

const blank = (value: string | null | undefined) => (value ?? "").trim() === "";

function localToday(today: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

function checkPhone(errors: Errors, key: string, label: string, value: string) {
  const length = value.trim().length;
  if (length === 0) {
    errors[key] = requiredMessage(label);
  } else if (length < 9 || length > 20) {
    errors[key] = `${label} must be between 9 and 20 characters.`;
  }
}

/** Step 1 — Basic Information (form fields + profile rules). */
export function validateStep1(form: WizardForm, profile: RequirementProfile, today: Date = new Date()): Errors {
  const errors: Errors = {};

  if (!form.branchId) {
    errors.branchId = requiredMessage("Branch");
  }
  if (blank(form.firstName)) {
    errors.firstName = requiredMessage("First Name");
  } else if (form.firstName.trim().length > 80) {
    errors.firstName = "First Name may not be longer than 80 characters.";
  }
  if (blank(form.lastName)) {
    errors.lastName = requiredMessage("Last name");
  } else if (form.lastName.trim().length > 80) {
    errors.lastName = "Last name may not be longer than 80 characters.";
  }
  if (form.gender !== "male" && form.gender !== "female") {
    errors.gender = requiredMessage("Gender");
  }
  if (blank(form.dob)) {
    errors.dob = MESSAGES.dobRequired;
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.dob) || form.dob >= localToday(today)) {
    errors.dob = MESSAGES.dobPast;
  }
  checkPhone(errors, "phone", "Phone Number", form.phone);

  if (form.dependentsCount.trim() !== "") {
    const count = Number(form.dependentsCount);
    if (!Number.isInteger(count) || count < 0 || count > 50) {
      errors.dependentsCount = "Number of Dependents must be between 0 and 50.";
    }
  }

  if (profile.requiresCustomerCategory && !form.customerCategoryId) {
    errors.customerCategoryId = MESSAGES.customerType;
  }
  if (profile.requiresMaritalStatus && !form.maritalStatusId) {
    errors.maritalStatusId = MESSAGES.maritalStatus;
  }
  if (profile.requiresIdentityDocument && (!form.idTypeId || blank(form.idNumber))) {
    errors.idTypeId = MESSAGES.identity;
  }
  if (profile.requiresAddress) {
    if (!form.regionId) {
      errors.regionId = MESSAGES.region;
    }
    if (!form.districtId) {
      errors.districtId = MESSAGES.district;
    }
  }

  form.nextOfKin.forEach((row, index) => {
    if (blank(row.name)) {
      errors[`nextOfKin.${index}.name`] = requiredMessage("Full Name");
    }
    checkPhone(errors, `nextOfKin.${index}.phone`, "Phone", row.phone);
    if (blank(row.relationship)) {
      errors[`nextOfKin.${index}.relationship`] = requiredMessage("Relationship");
    }
  });
  if (profile.minNextOfKin > 0 && form.nextOfKin.length < profile.minNextOfKin) {
    errors.nextOfKin = nextOfKinMinimum(profile.minNextOfKin);
  }

  return errors;
}

/** Error key of a Step 2 field: the column for `storesIn`, else dynamicFormData.<key>. */
export function fieldErrorKey(field: FieldDef): string {
  return field.storesIn ? field.storesIn : `dynamicFormData.${field.key}`;
}

/** True when `requiredWhen` holds: the referenced value, or the master-data code of the row it names, is listed. */
export function requiredWhenHolds(field: FieldDef, form: WizardForm, fields: FieldDef[], codeOf?: (field: FieldDef, value: string) => string | null | undefined): boolean {
  if (!field.requiredWhen) {
    return false;
  }
  const reference = fields.find((item) => item.key === field.requiredWhen?.field);
  if (!reference) {
    return false;
  }
  const value = answerOf(form, reference);
  if (blank(value)) {
    return false;
  }
  const equals = field.requiredWhen.equals.map(String);
  const code = codeOf?.(reference, value);
  return equals.includes(value) || (code !== null && code !== undefined && equals.includes(code));
}

/** Checks the composed Step 2 fields: required, then number / currency, date and fixed-option formats. */
export function validateComposedFields(form: WizardForm, fields: FieldDef[], codeOf?: (field: FieldDef, value: string) => string | null | undefined): Errors {
  const errors: Errors = {};
  for (const field of fields) {
    const key = fieldErrorKey(field);
    const value = answerOf(form, field).trim();
    const required = Boolean(field.required) || requiredWhenHolds(field, form, fields, codeOf);
    if (value === "") {
      if (required) {
        errors[key] = requiredMessage(field.label);
      }
      continue;
    }
    if ((field.type === "number" || field.type === "currency") && !Number.isFinite(Number(value.replace(/,/g, "")))) {
      errors[key] = `${field.label} must be a number.`;
    } else if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors[key] = `${field.label} must be a date (YYYY-MM-DD).`;
    } else if (field.type === "select" && field.options && field.options.length > 0 && !field.options.includes(value)) {
      errors[key] = `${field.label} must be one of the listed options.`;
    } else if (field.type === "select" && field.dataSource && !/^\d+$/.test(value)) {
      errors[key] = `${field.label} must be chosen from the list.`;
    }
  }
  return errors;
}

/** Account Number (MNO / BANK) section. */
export function validatePayment(form: WizardForm, profile: Pick<RequirementProfile, "requiresBankAccount">): Errors {
  const errors: Errors = {};
  if (form.paymentMethod === "mno") {
    if (!form.mobileMoneyProviderId) {
      errors.mobileMoneyProviderId = MESSAGES.mnoProvider;
    }
    if (blank(form.walletNumber)) {
      errors.walletNumber = MESSAGES.wallet;
    }
  } else if (form.paymentMethod === "bank") {
    if (!form.bankId) {
      errors.bankId = MESSAGES.bank;
    }
    if (blank(form.accountName)) {
      errors.accountName = MESSAGES.accountName;
    }
    if (blank(form.accountNumber)) {
      errors["bankDetails.accountNumber"] = MESSAGES.accountNumber;
    }
  } else if (profile.requiresBankAccount) {
    errors.paymentMethod = MESSAGES.paymentRequired;
  }
  return errors;
}

/** Step 2 — Customer Details (type questions + profile rules + guarantors + payment). */
export function validateStep2(
  form: WizardForm,
  fields: FieldDef[],
  profile: RequirementProfile,
  codeOf?: (field: FieldDef, value: string) => string | null | undefined,
): Errors {
  const errors: Errors = { ...validateComposedFields(form, fields, codeOf) };

  if (profile.requiresEmploymentDetails) {
    if (blank(form.placeOfEmployment)) {
      errors.employer ??= MESSAGES.employer;
    }
    // Satisfied only by the workType / employmentType columns, as on the server (the wizard does not collect them).
    const extra = form as unknown as Record<string, unknown>;
    if (blank(extra.workType as string | undefined) && blank(extra.employmentType as string | undefined)) {
      errors.workType ??= MESSAGES.workType;
    }
    if (blank(form.takeHome) && blank(form.basicSalary) && blank(form.monthlyIncome)) {
      errors.takeHome ??= MESSAGES.income;
    }
  }
  if (profile.requiresBusinessDetails) {
    if (blank(form.businessName)) {
      errors.businessName ??= MESSAGES.businessName;
    }
    if (blank(form.businessType)) {
      errors.businessType ??= MESSAGES.businessType;
    }
  }

  if (profile.minGuarantors > 0) {
    form.guarantors.forEach((row, index) => {
      if (blank(row.name)) {
        errors[`guarantors.${index}.name`] = requiredMessage("Full Name");
      }
      checkPhone(errors, `guarantors.${index}.phone`, "Phone", row.phone);
      if (blank(row.relationship)) {
        errors[`guarantors.${index}.relationship`] = requiredMessage("Relationship");
      }
    });
    if (form.guarantors.length < profile.minGuarantors) {
      errors.guarantors = guarantorMinimum(profile.minGuarantors);
    }
  }

  return { ...errors, ...validatePayment(form, profile) };
}

/** Step 3 — the single KYC attachment. */
export function validateStep3(file: File | Blob | null | undefined): Errors {
  return file ? {} : { file: MESSAGES.attachment };
}
