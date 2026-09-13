/**
 * Requirement profile used by the wizard: the baseline (isDefault / no account type), merged with a row for the
 * chosen customer type when the API returns one (flags OR-ed, minimums maxed) — the same merge the server does.
 */
import type { RequirementProfile } from "../types";

const FLAGS = [
  "requiresEmploymentDetails",
  "requiresBusinessDetails",
  "requiresBankAccount",
  "requiresCardDetails",
  "requiresCustomerCategory",
  "requiresMaritalStatus",
  "requiresAddress",
  "requiresIdentityDocument",
  "requiresCategoryDocuments",
  "requiresFaceVerification",
  "requiresNidaVerification",
  "requiresOtpVerification",
] as const;

/** Reference baseline, used only until the API answers. */
export const FALLBACK_PROFILE: RequirementProfile = {
  accountTypeId: null,
  accountTypeName: null,
  isDefault: true,
  requiresEmploymentDetails: false,
  requiresBusinessDetails: false,
  requiresBankAccount: false,
  requiresCardDetails: false,
  minGuarantors: 0,
  minNextOfKin: 0,
  requiresCustomerCategory: false,
  requiresMaritalStatus: false,
  requiresAddress: true,
  requiresIdentityDocument: true,
  requiresCategoryDocuments: false,
  categoryDocumentsEnforcedFrom: null,
  requiresFaceVerification: true,
  requiresNidaVerification: false,
  requiresOtpVerification: false,
  guidance: "Baseline requirements. Choosing an account type may add to these.",
};

export function resolveProfile(profiles: RequirementProfile[] | null | undefined, customerCategoryId: number | null): RequirementProfile {
  const list = profiles ?? [];
  const baseline =
    list.find((profile) => profile.isDefault) ??
    list.find((profile) => profile.accountTypeId === null && !profile.customerCategoryId) ??
    FALLBACK_PROFILE;

  const typeRows = customerCategoryId ? list.filter((profile) => profile !== baseline && profile.accountTypeId === null && profile.customerCategoryId === customerCategoryId) : [];
  if (typeRows.length === 0) {
    return baseline;
  }

  const merged: RequirementProfile = { ...baseline };
  for (const row of typeRows) {
    for (const flag of FLAGS) {
      merged[flag] = Boolean(merged[flag] || row[flag]);
    }
    merged.minGuarantors = Math.max(merged.minGuarantors, row.minGuarantors ?? 0);
    merged.minNextOfKin = Math.max(merged.minNextOfKin, row.minNextOfKin ?? 0);
    merged.guidance = row.guidance || merged.guidance;
  }
  return merged;
}
