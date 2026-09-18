import { describe, expect, it } from "vitest";

import type { Customer } from "../types";
import { buildRegistrationPayload, changedPayload, errorsForChanges, formFromCustomer } from "./form";

const customer = {
  id: 264,
  firstName: "MARKO",
  middleName: "D.",
  lastName: "VUKARI",
  gender: null,
  dob: null,
  phone: "255756544927",
  branchId: 3,
  employeeId: null,
  customerCategoryId: null,
  idTypeId: null,
  idNumber: null,
  nidaNumber: null,
  walletNumber: null,
  mobileMoneyProviderId: null,
  accountNumber: null,
  bankId: null,
  paymentMethod: null,
  dynamicFormData: {},
  nextOfKin: [{ id: 1, name: "ANNA VUKARI", relationship: "spouse", phone: "255700000001", address: null }],
  guarantors: [],
} as unknown as Customer;

describe("editing a customer", () => {
  it("fills the wizard with the customer's current values", () => {
    const form = formFromCustomer({ ...customer, gender: "Male" });

    expect(form.firstName).toBe("MARKO");
    expect(form.middleName).toBe("D.");
    expect(form.phone).toBe("255756544927");
    expect(form.branchId).toBe(3);
    expect(form.gender).toBe("male");
    expect(form.nextOfKin).toEqual([{ name: "ANNA VUKARI", phone: "255700000001", relationship: "spouse", address: "" }]);
    expect(form.paymentMethod).toBe("none");
  });

  it("sends only the fields that changed, never verification stamps", () => {
    const before = formFromCustomer(customer);
    const after = { ...before, gender: "male" as const, dob: "1980-01-02" };

    expect(changedPayload(buildRegistrationPayload(before, []), buildRegistrationPayload(after, []))).toEqual({ gender: "male", dob: "1980-01-02" });
    expect(changedPayload(buildRegistrationPayload(before, []), buildRegistrationPayload(before, []))).toEqual({});
  });

  it("reports only errors about what changed, unless the customer type changed", () => {
    const errors = { dob: "Date of Birth is required.", "guarantors.0.phone": "Phone is required.", gender: "Gender is required." };

    expect(errorsForChanges(errors, { gender: "male", guarantors: [] })).toEqual({ "guarantors.0.phone": "Phone is required.", gender: "Gender is required." });
    expect(errorsForChanges(errors, { customerCategoryId: 2 })).toEqual(errors);
  });
});
