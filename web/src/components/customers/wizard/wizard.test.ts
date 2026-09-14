import { describe, expect, it } from "vitest";

import type { CustomerType, FieldDef, RequirementProfile } from "../types";
// The reference export shipped with the API (identical to the spec package's customer-types.json).
import reference from "../../../../../api/database/data/customer-module-types.json";
import { composeStep2Fields } from "./composition";
import { errorToast, firstErrorStep, flattenServerErrors, labelForErrorKey, stepForErrorKey } from "./errors";
import {
  ageFrom,
  answerOf,
  buildRegistrationPayload,
  changeCustomerType,
  draftLabel,
  emptyForm,
  emptyNextOfKin,
  repairDraftPayload,
  resumeStep,
  setAnswer,
  setDistrict,
  setRegion,
  switchPaymentMethod,
  type WizardForm,
} from "./form";
import { FALLBACK_PROFILE, resolveProfile } from "./profile";
import { MESSAGES, guarantorMinimum, nextOfKinMinimum, validatePayment, validateStep1, validateStep2, validateStep3 } from "./validation";

type ReferenceType = (typeof reference.customerTypes)[number];

function toType(item: ReferenceType, id: number): CustomerType {
  return { ...(item as unknown as CustomerType), id, sector: item.sector as CustomerType["sector"] };
}

const TYPES = reference.customerTypes.map((item, index) => toType(item, index + 1));
const byCode = (code: string) => TYPES.find((type) => type.code === code) as CustomerType;
const profile = (patch: Partial<RequirementProfile> = {}): RequirementProfile => ({ ...FALLBACK_PROFILE, ...patch });

function validStep1(patch: Partial<WizardForm> = {}): WizardForm {
  return {
    ...emptyForm(),
    branchId: 2,
    firstName: "Asha",
    lastName: "Juma",
    gender: "female",
    dob: "1990-05-01",
    phone: "0754000000",
    idTypeId: 1,
    idNumber: "19900501-00000-00000-11",
    regionId: 3,
    districtId: 7,
    ...patch,
  };
}

describe("Step 2 composition", () => {
  it.each(reference.customerTypes.map((item) => [item.code, item] as const))("%s equals resolvedStep2Fields", (code, item) => {
    const composed = composeStep2Fields(byCode(code), FALLBACK_PROFILE);
    expect(composed).toEqual(item.resolvedStep2Fields);
  });

  it.each([
    ["Mtumishi wa Umma", ["taasisi", "idara", "cheo", "kituo", "check_number", "aina_ajira", "basic_salary", "take_home", "retirement_date"]],
    ["Sekta Binafsi", ["sb_sekta", "sb_taasisi", "sb_idara", "sb_cheo", "sb_kituo", "sb_aina_mkataba", "sb_kitambulisho", "basic_salary", "take_home", "retirement_date"]],
    ["Mjasiriamali/Mfanyabiashara", ["sekta", "aina", "jina_biashara", "muda_biashara", "mapato", "wafanyakazi", "mahali_biashara", "tin_number"]],
    ["Mwanafunzi wa Chuo", ["chuo", "kozi", "level", "mwaka", "email_chuo", "mdhamini", "mdhamini_simu", "monthly_income"]],
    ["Mstaafu (Umma)", ["mstaafu_taasisi", "mstaafu_idara", "mstaafu_cheo", "makazi", "pensheni", "mfuko", "namba_mfuko", "retirement_date"]],
  ])("customer type %s shows the documented Step 2 field keys", (name, keys) => {
    const type = TYPES.find((item) => item.name === name) as CustomerType;
    expect(composeStep2Fields(type, FALLBACK_PROFILE).map((field) => field.key)).toEqual(keys);
  });

  it("the five customer types are ordered as configured", () => {
    expect([...TYPES].sort((a, b) => a.sortOrder - b.sortOrder).map((type) => type.name)).toEqual([
      "Mtumishi wa Umma", "Sekta Binafsi", "Mjasiriamali/Mfanyabiashara", "Mwanafunzi wa Chuo", "Mstaafu (Umma)",
    ]);
  });

  it("returns nothing without a type", () => {
    expect(composeStep2Fields(null)).toEqual([]);
  });

  it("adds the business block when the profile requires business details", () => {
    const keys = composeStep2Fields(byCode("MWANAFUNZI_CHUO"), profile({ requiresBusinessDetails: true })).map((field) => field.key);
    expect(keys).toContain("business_name");
    expect(keys.filter((key) => key === "monthly_income")).toHaveLength(1);
  });

  it("never renders fields collected elsewhere", () => {
    const type: CustomerType = {
      ...byCode("MWANAFUNZI_CHUO"),
      dynamicFormSchema: [{ key: "wallet", label: "Wallet", type: "text", storesIn: "walletNumber" }],
    };
    expect(composeStep2Fields(type).map((field) => field.key)).not.toContain("wallet");
  });

  it("inserts contract fields after Check Number when requiresContract", () => {
    const type: CustomerType = { ...byCode("WATUMISHI_WA_UMMA"), dynamicFormSchema: [], omittedStandardFields: [], requiresContract: true, requiresSector: true };
    expect(composeStep2Fields(type).map((field) => field.key)).toEqual([
      "sector_id",
      "sector_category_id",
      "place_of_employment",
      "check_number",
      "contract_type_id",
      "contract_expiry_date",
      "basic_salary",
      "take_home",
      "monthly_income",
      "retirement_date",
    ]);
  });
});

describe("customer-type corrections", () => {
  it("Mtumishi wa Umma asks Basic Salary and Take Home but not Place of Employment or Monthly Income", () => {
    const fields = composeStep2Fields(byCode("WATUMISHI_WA_UMMA"), FALLBACK_PROFILE);
    const labels = fields.map((field) => field.label);
    expect(labels).not.toContain("Place of Employment");
    expect(labels).not.toContain("Monthly Income");
    expect(labels).toEqual(expect.arrayContaining(["Basic Salary", "Take Home"]));

    const form = setAnswer(setAnswer({ ...validStep1(), placeOfEmployment: "Hospitali", monthlyIncome: "700000" }, fields, "basic_salary", "900000"), fields, "take_home", "650000");
    const payload = buildRegistrationPayload(form, fields);
    expect(payload).toMatchObject({ basicSalary: 900000, takeHome: 650000 });
    expect(payload).not.toHaveProperty("placeOfEmployment");
    expect(payload).not.toHaveProperty("monthlyIncome");
    expect(validateStep2(form, fields, FALLBACK_PROFILE)).not.toHaveProperty("placeOfEmployment");
    expect(validateStep2(form, fields, FALLBACK_PROFILE)).not.toHaveProperty("monthlyIncome");
  });

  it("the other types keep their Place of Employment / Monthly Income handling", () => {
    const keys = (code: string) => composeStep2Fields(byCode(code), FALLBACK_PROFILE).map((field) => field.key);
    expect(keys("MWANAFUNZI_CHUO")).toContain("monthly_income");
    expect(keys("SEKTA_BINAFSI")).toEqual(expect.arrayContaining(["basic_salary", "take_home"]));
    expect(keys("MSTAAFU_UMMA")).not.toContain("basic_salary");
  });

  it("Sekta Binafsi Aina ya Mkataba offers Vibarua and submits it", () => {
    const fields = composeStep2Fields(byCode("SEKTA_BINAFSI"), FALLBACK_PROFILE);
    const contract = fields.find((field) => field.key === "sb_aina_mkataba");
    expect(contract?.options).toEqual(["Ajira ya Kudumu", "Mkataba wa Muda", "Vibarua"]);
    const form = setAnswer(validStep1(), fields, "sb_aina_mkataba", "Vibarua");
    expect(buildRegistrationPayload(form, fields)).toMatchObject({ dynamicFormData: { sb_aina_mkataba: "Vibarua" } });
    expect(Object.keys(validateStep2(form, fields, FALLBACK_PROFILE))).not.toContain("dynamicFormData.sb_aina_mkataba");
    const invalid = setAnswer(validStep1(), fields, "sb_aina_mkataba", "Kibarua cha Siku");
    expect(Object.keys(validateStep2(invalid, fields, FALLBACK_PROFILE))).toContain("dynamicFormData.sb_aina_mkataba");
  });
});

describe("Step 1 validation messages", () => {
  const today = new Date(2026, 8, 13);

  it("requires the basic fields", () => {
    const errors = validateStep1(emptyForm(), profile(), today);
    expect(errors).toMatchObject({
      branchId: "Branch is required.",
      firstName: "First Name is required.",
      lastName: "Last name is required.",
      gender: "Gender is required.",
      dob: MESSAGES.dobRequired,
      phone: "Phone Number is required.",
      idTypeId: "An identity document is required — choose the ID type and enter the number shown on it.",
      regionId: "Region is required.",
      districtId: "District must be selected.",
    });
  });

  it("refuses today and future dates of birth", () => {
    expect(validateStep1(validStep1({ dob: "2026-09-13" }), profile(), today).dob).toBe("Date of birth must be in the past.");
    expect(validateStep1(validStep1({ dob: "2030-01-01" }), profile(), today).dob).toBe("Date of birth must be in the past.");
    expect(validateStep1(validStep1(), profile(), today)).toEqual({});
  });

  it("applies profile rules", () => {
    const strict = profile({ requiresMaritalStatus: true, requiresCustomerCategory: true, minNextOfKin: 1 });
    const errors = validateStep1(validStep1(), strict, today);
    expect(errors.maritalStatusId).toBe("Marital status is required for this account type.");
    expect(errors.customerCategoryId).toBe("A customer type is required for this account type — it decides which loan products the customer may take.");
    expect(errors.nextOfKin).toBe("At least 1 next of kin is required for this account type.");
    expect(nextOfKinMinimum(2)).toBe("At least 2 next of kin are required for this account type.");
    expect(guarantorMinimum(1)).toBe("At least 1 guarantor is required for this account type.");
    expect(guarantorMinimum(3)).toBe("At least 3 guarantors are required for this account type.");
  });

  it("does not enforce address or identity when the profile does not require them", () => {
    const relaxed = profile({ requiresAddress: false, requiresIdentityDocument: false });
    expect(validateStep1(validStep1({ regionId: null, districtId: null, idTypeId: null, idNumber: "" }), relaxed, today)).toEqual({});
  });

  it("checks next of kin rows", () => {
    const errors = validateStep1(validStep1({ nextOfKin: [emptyNextOfKin()] }), profile(), today);
    expect(errors["nextOfKin.0.name"]).toBe("Full Name is required.");
    expect(errors["nextOfKin.0.phone"]).toBe("Phone is required.");
  });
});

describe("Step 2 validation messages", () => {
  const mtumishi = byCode("WATUMISHI_WA_UMMA");
  const fields = composeStep2Fields(mtumishi);

  it("requires configured answers with the <Label> is required. message", () => {
    const errors = validateStep2(validStep1(), fields, profile());
    expect(errors["dynamicFormData.taasisi"]).toBe("Wizara / Taasisi ya Serikali is required.");
    expect(errors["dynamicFormData.check_number"]).toBe("Check Namba is required.");
    expect(errors.basicSalary).toBeUndefined();
  });

  it("uses the column name for storesIn fields and checks formats", () => {
    const boom = composeStep2Fields(byCode("MWANAFUNZI_CHUO"));
    const form = validStep1({ monthlyIncome: "abc" });
    expect(validateStep2(form, boom, profile()).monthlyIncome).toBe("Boom must be a number.");
    const levels = validateStep2(validStep1({ dynamicFormData: { level: "Nope" } }), boom, profile());
    expect(levels["dynamicFormData.level"]).toBe("Level must be one of the listed options.");
  });

  it("enforces requiredWhen by value or master-data code", () => {
    const type: CustomerType = { ...mtumishi, dynamicFormSchema: [], requiresContract: true };
    const composed = composeStep2Fields(type);
    const form = validStep1({ contractTypeId: "4" });
    expect(validateStep2(form, composed, profile(), () => "PERMANENT").contractExpiryDate).toBeUndefined();
    expect(validateStep2(form, composed, profile(), () => "TEMPORARY").contractExpiryDate).toBe("Contract Expiry Date is required.");
  });

  it("applies employment and business profile rules", () => {
    const errors = validateStep2(validStep1(), [], profile({ requiresEmploymentDetails: true, requiresBusinessDetails: true, minGuarantors: 2 }));
    expect(errors.employer).toBe("An employer or place of employment is required for this account type.");
    expect(errors.workType).toBe("Work type or type of employment is required for this account type.");
    expect(errors.takeHome).toBe("An income figure is required for this account type.");
    expect(errors.businessName).toBe("Business name is required for this account type.");
    expect(errors.businessType).toBe("Business type is required for this account type.");
    expect(errors.guarantors).toBe("At least 2 guarantors are required for this account type.");
  });

  it("checks the payment section", () => {
    expect(validatePayment({ ...emptyForm(), paymentMethod: "mno" }, profile())).toEqual({
      mobileMoneyProviderId: "Choose the mobile money provider.",
      walletNumber: "Enter the number the wallet is registered on.",
    });
    expect(validatePayment({ ...emptyForm(), paymentMethod: "bank" }, profile())).toEqual({
      bankId: "Choose the bank.",
      accountName: "Enter the name the account is held in.",
      "bankDetails.accountNumber": "Enter the account number.",
    });
    expect(validatePayment(emptyForm(), profile({ requiresBankAccount: true }))).toEqual({
      paymentMethod: "A bank account or a mobile money wallet number is required for this account type.",
    });
    expect(validatePayment(emptyForm(), profile())).toEqual({});
  });

  it("requires the KYC attachment on Step 3", () => {
    expect(validateStep3(null)).toEqual({ file: "Attach the customer's KYC documents before saving." });
    expect(validateStep3(new Blob(["x"]))).toEqual({});
  });
});

describe("error → step mapping", () => {
  it.each([
    ["firstName", 0],
    ["dob", 0],
    ["branchId", 0],
    ["employeeId", 0],
    ["nidaNumber", 0],
    ["wardName", 0],
    ["customerCategoryId", 0],
    ["nextOfKin", 0],
    ["nextOfKin.0.phone", 0],
    ["dynamicFormData.taasisi", 1],
    ["monthlyIncome", 1],
    ["bankDetails.accountNumber", 1],
    ["walletNumber", 1],
    ["guarantors.1.name", 1],
    ["tinNumber", 1],
    ["documents.0.file", 2],
    ["attachments", 2],
    ["customerDocuments.0", 2],
    ["file", 2],
  ] as const)("%s → step %i", (key, step) => {
    expect(stepForErrorKey(key)).toBe(step);
  });

  it("picks the earliest step and names up to three fields", () => {
    const errors = flattenServerErrors({ "dynamicFormData.kituo": ["Kituo cha Kazi is required."], phone: ["The phone has already been taken."], regionId: ["Region is required."], walletNumber: ["x"], file: ["y"] });
    expect(firstErrorStep(errors)).toBe(0);
    const fields = composeStep2Fields(byCode("WATUMISHI_WA_UMMA"));
    expect(labelForErrorKey("dynamicFormData.kituo", fields)).toBe("Kituo cha Kazi");
    expect(labelForErrorKey("nextOfKin.1.phone")).toBe("Next of kin 2 phone");
    expect(errorToast(errors, fields)).toBe("Please check Kituo cha Kazi, Phone Number, Region +2 more.");
    expect(errorToast({ phone: "x", dob: "y" })).toBe("Please check Phone Number and Date of Birth.");
  });
});

describe("form updates", () => {
  it("clears the other payment kind when switching", () => {
    const mno = { ...emptyForm(), paymentMethod: "mno" as const, mobileMoneyProviderId: 2, mobileMoneyProvider: "M-Pesa", walletNumber: "0754000000" };
    const bank = switchPaymentMethod(mno, "bank");
    expect(bank).toMatchObject({ paymentMethod: "bank", mobileMoneyProviderId: null, mobileMoneyProvider: "", walletNumber: "" });
    const filled = { ...bank, bankId: 4, bankName: "CRDB", bankBranch: "Kigoma", accountName: "Asha", accountNumber: "0150" };
    expect(switchPaymentMethod(filled, "mno")).toMatchObject({ bankId: null, bankName: "", bankBranch: "", accountName: "", accountNumber: "" });
    expect(switchPaymentMethod(filled, null)).toMatchObject({ paymentMethod: "none", bankId: null, accountNumber: "" });
  });

  it("clears descendants when a cascade parent changes", () => {
    const fields = composeStep2Fields(byCode("SEKTA_BINAFSI"));
    let form = emptyForm();
    form = setAnswer(form, fields, "sb_sekta", "1");
    form = setAnswer(form, fields, "sb_taasisi", "10");
    form = setAnswer(form, fields, "sb_idara", "20");
    form = setAnswer(form, fields, "sb_cheo", "30");
    form = setAnswer(form, fields, "sb_kituo", "Dodoma");
    form = setAnswer(form, fields, "sb_idara", "21");
    expect(form.dynamicFormData).toEqual({ sb_sekta: "1", sb_taasisi: "10", sb_idara: "21", sb_kituo: "Dodoma" });
    form = setAnswer(form, fields, "sb_sekta", "2");
    expect(form.dynamicFormData).toEqual({ sb_sekta: "2", sb_kituo: "Dodoma" });
    form = setAnswer(form, fields, "sb_sekta", "2");
    expect(form.dynamicFormData).toEqual({ sb_sekta: "2", sb_kituo: "Dodoma" });
  });

  it("clears geography below the changed level", () => {
    const form = { ...emptyForm(), regionId: 1, districtId: 2, wardId: 3, wardName: "Kasulu", streetName: "Mtaa" };
    expect(setDistrict(form, 5)).toMatchObject({ regionId: 1, districtId: 5, wardId: null, wardName: "", streetName: "" });
    expect(setRegion(form, 9)).toMatchObject({ regionId: 9, districtId: null, wardId: null, wardName: "", streetName: "" });
  });

  it("clears previous type answers (JSON and columns) on type change", () => {
    const boomFields = composeStep2Fields(byCode("MWANAFUNZI_CHUO"));
    const form = { ...emptyForm(), customerCategoryId: 4, dynamicFormData: { chuo: "1" }, monthlyIncome: "50000" };
    const next = changeCustomerType(form, boomFields, 1);
    expect(next.customerCategoryId).toBe(1);
    expect(next.dynamicFormData).toEqual({});
    expect(next.monthlyIncome).toBe("");
    expect(answerOf(next, boomFields[0])).toBe("");
  });
});

describe("registration payload", () => {
  it("never submits age, maps storesIn to columns and none to null", () => {
    const fields = composeStep2Fields(byCode("MWANAFUNZI_CHUO"));
    const form = validStep1({ dependentsCount: "", monthlyIncome: "120000", dynamicFormData: { chuo: "3", level: "Shahada (Degree)", monthly_income: "999" } });
    const payload = buildRegistrationPayload(form, fields);
    expect(payload).not.toHaveProperty("age");
    expect(payload.dependentsCount).toBeNull();
    expect(payload.monthlyIncome).toBe(120000);
    expect(payload.dynamicFormData).toEqual({ chuo: "3", level: "Shahada (Degree)" });
    expect(payload.paymentMethod).toBeNull();
    expect(payload.bankDetails).toBeNull();
    expect(payload).not.toHaveProperty("basicSalary");
    expect(ageFrom("1990-05-01", new Date(2026, 8, 13))).toBe(36);
  });

  it("sends bank details with the customer phone", () => {
    const form = { ...validStep1(), paymentMethod: "bank" as const, bankId: 3, bankName: "NMB Bank", bankBranch: "Kigoma", accountName: "Asha Juma", accountNumber: "20110000" };
    const payload = buildRegistrationPayload(form, []);
    expect(payload).toMatchObject({
      paymentMethod: "bank",
      bankId: 3,
      bankBranch: "Kigoma",
      accountName: "Asha Juma",
      walletNumber: null,
      mobileMoneyProviderId: null,
      bankDetails: { bankName: "NMB Bank", accountNumber: "20110000", accountName: "Asha Juma", phoneNumber: "0754000000" },
    });
  });

  it("builds the draft label", () => {
    expect(draftLabel({ firstName: "Asha", lastName: "Juma", phone: "07" })).toBe("Asha Juma");
    expect(draftLabel({ firstName: "", lastName: "", phone: "0754" })).toBe("0754");
    expect(draftLabel({ firstName: "", lastName: "", phone: "" })).toBe("Unnamed registration");
  });
});

describe("draft payload repair", () => {
  it("round-trips the current shape", () => {
    const form: WizardForm = { ...validStep1(), customerCategoryId: 2, dynamicFormData: { sb_sekta: "1" }, paymentMethod: "mno", mobileMoneyProviderId: 1, mobileMoneyProvider: "M-Pesa", walletNumber: "0754", nextOfKin: [{ name: "Juma", phone: "0755000000", relationship: "parent", address: "" }] };
    expect(repairDraftPayload(JSON.parse(JSON.stringify(form)))).toEqual(form);
  });

  it("repairs older shapes", () => {
    const repaired = repairDraftPayload({
      branchId: "2",
      customerCategoryId: "5",
      regionId: "",
      dependentsCount: 3,
      dynamicFormData: [],
      nextOfKin: { first_name: "Juma", last_name: "Ali", phone: "0755000000", relationship: "Parent" },
      guarantors: null,
      accountNumber: "0150",
      bankId: "4",
      walletNumber: "",
      basicSalary: 450000,
      wardName: "Typed ward",
    });
    expect(repaired.branchId).toBe(2);
    expect(repaired.customerCategoryId).toBe(5);
    expect(repaired.regionId).toBeNull();
    expect(repaired.dependentsCount).toBe("3");
    expect(repaired.dynamicFormData).toEqual({});
    expect(repaired.nextOfKin).toEqual([{ name: "Juma Ali", phone: "0755000000", relationship: "parent", address: "" }]);
    expect(repaired.guarantors).toEqual([]);
    expect(repaired.paymentMethod).toBe("bank");
    expect(repaired.bankId).toBe(4);
    expect(repaired.basicSalary).toBe("450000");
    expect(repaired.wardMode).toBe("text");
  });

  it("normalises array answers and infers MNO", () => {
    const repaired = repairDraftPayload({ dynamicFormData: [["taasisi", 12], { key: "kituo", value: "Kigoma" }], walletNumber: "0754000000", mobileMoneyProviderId: "1", bankId: 9 });
    expect(repaired.dynamicFormData).toEqual({ taasisi: "12", kituo: "Kigoma" });
    expect(repaired.paymentMethod).toBe("mno");
    expect(repaired.bankId).toBeNull();
  });

  it("tolerates garbage and clamps the step", () => {
    expect(repairDraftPayload("nonsense")).toEqual(emptyForm());
    expect(resumeStep(7)).toBe(2);
    expect(resumeStep("1")).toBe(1);
    expect(resumeStep(undefined)).toBe(0);
  });
});

describe("requirement profile", () => {
  it("uses the default profile and merges a customer-type row", () => {
    const base = profile({ isDefault: true });
    const typeRow = profile({ isDefault: false, customerCategoryId: 3, requiresAddress: false, minNextOfKin: 2, requiresBankAccount: true, guidance: "Type" });
    expect(resolveProfile([typeRow, base], null)).toBe(base);
    const merged = resolveProfile([base, typeRow], 3);
    expect(merged.requiresAddress).toBe(true);
    expect(merged.requiresBankAccount).toBe(true);
    expect(merged.minNextOfKin).toBe(2);
  });
});

// Ensure the fixture's field objects are valid FieldDef values.
const _typed: FieldDef[] = reference.customerTypes[0].resolvedStep2Fields as FieldDef[];
void _typed;
