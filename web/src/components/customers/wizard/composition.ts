/**
 * Step 2 field composition (CUSTOMER_TYPE_REQUIREMENTS §2, customer-types.json compositionRules).
 * ONE function feeds both the Step 2 card rendering and its client validation.
 */
import type { CustomerType, FieldDef, RequirementProfile } from "../types";

type ProfileFlags = Pick<RequirementProfile, "requiresEmploymentDetails" | "requiresBusinessDetails">;

const EMPLOYMENT_HEAD: FieldDef[] = [
  { key: "place_of_employment", label: "Place of Employment", type: "text", required: false, storesIn: "placeOfEmployment" },
  { key: "check_number", label: "Check Number", type: "text", required: false, storesIn: "checkNumber", helpText: "The payroll check number, where the employer issues one." },
];

const EMPLOYMENT_TAIL: FieldDef[] = [
  { key: "basic_salary", label: "Basic Salary", type: "currency", required: false, storesIn: "basicSalary" },
  { key: "take_home", label: "Take Home", type: "currency", required: false, storesIn: "takeHome" },
  { key: "monthly_income", label: "Monthly Income", type: "currency", required: false, storesIn: "monthlyIncome" },
  { key: "retirement_date", label: "Date of Retirement", type: "date", required: false, storesIn: "retirementDate", helpText: "Where the employer sets one." },
];

const WHEN_REQUIRES_SECTOR: FieldDef[] = [
  { key: "sector_id", label: "Sector", type: "select", required: false, storesIn: "sectorId", dataSource: "sectors" },
  { key: "sector_category_id", label: "Cadre", type: "select", required: false, storesIn: "sectorCategoryId", dataSource: "sector-categories", dependsOn: "sector_id" },
];

const WHEN_REQUIRES_EMPLOYER: FieldDef[] = [
  { key: "employer_id", label: "Employer", type: "select", required: false, storesIn: "employerId", dataSource: "employers" },
];

const WHEN_REQUIRES_CONTRACT: FieldDef[] = [
  { key: "contract_type_id", label: "Contract Type", type: "select", required: false, storesIn: "contractTypeId", dataSource: "contract-types" },
  {
    key: "contract_expiry_date",
    label: "Contract Expiry Date",
    type: "date",
    required: false,
    storesIn: "contractExpiryDate",
    dependsOn: "contract_type_id",
    requiredWhen: { field: "contract_type_id", equals: ["TEMPORARY"] },
  },
];

export const BUSINESS_BLOCK: FieldDef[] = [
  { key: "business_name", label: "Business Name", type: "text", required: false, storesIn: "businessName" },
  { key: "business_type", label: "Business Type", type: "text", required: false, storesIn: "businessType", placeholder: "Retail, transport, agriculture…" },
  { key: "business_address", label: "Business Address", type: "text", required: false, storesIn: "businessAddress", fullWidth: true },
  { key: "tin_number", label: "TIN Number (Optional)", type: "text", required: false, storesIn: "tinNumber", helpText: "Where the business is registered for tax." },
  { key: "monthly_income", label: "Monthly Income", type: "currency", required: false, storesIn: "monthlyIncome" },
];

export const OTHER_BLOCK: FieldDef[] = [
  { key: "monthly_income", label: "Monthly Income", type: "currency", required: false, storesIn: "monthlyIncome" },
];

/** Payload columns collected on Step 1 or in the Account Number section — never rendered on Step 2. */
export const COLLECTED_ELSEWHERE = new Set([
  "dependentsCount",
  "alternativePhone",
  "email",
  "nationality",
  "maritalStatusId",
  "residenceType",
  "bankId",
  "bankBranch",
  "mobileMoneyProviderId",
  "walletNumber",
]);

/** Every column a standard field (or a configured `storesIn`) may write. */
export const STEP2_COLUMNS = [
  "placeOfEmployment",
  "checkNumber",
  "basicSalary",
  "takeHome",
  "monthlyIncome",
  "retirementDate",
  "businessName",
  "businessType",
  "businessAddress",
  "tinNumber",
  "sectorId",
  "sectorCategoryId",
  "employerId",
  "contractTypeId",
  "contractExpiryDate",
] as const;

function employmentBlock(type: Pick<CustomerType, "requiresSector" | "requiresEmployer" | "requiresContract">): FieldDef[] {
  return [
    ...(type.requiresSector ? WHEN_REQUIRES_SECTOR : []),
    ...(type.requiresEmployer ? WHEN_REQUIRES_EMPLOYER : []),
    ...EMPLOYMENT_HEAD,
    ...(type.requiresContract ? WHEN_REQUIRES_CONTRACT : []),
    ...EMPLOYMENT_TAIL,
  ];
}

/**
 * The customer type's Step 2 list: configured fields in order, then the remaining standard fields.
 * Returns [] without a type.
 */
export function composeStep2Fields(type: CustomerType | null | undefined, profile?: ProfileFlags | null): FieldDef[] {
  if (!type) {
    return [];
  }

  const configured: FieldDef[] = (Array.isArray(type.dynamicFormSchema) ? type.dynamicFormSchema : []).map((field) => ({ ...field, origin: "configured" as const }));

  const blocks: FieldDef[][] = [];
  if (type.sector === "employment" || profile?.requiresEmploymentDetails) {
    blocks.push(employmentBlock(type));
  }
  if (type.sector === "business" || profile?.requiresBusinessDetails) {
    blocks.push(BUSINESS_BLOCK);
  }
  if (type.sector === "other" || blocks.length === 0) {
    blocks.push(OTHER_BLOCK);
  }

  const omitted = new Set(Array.isArray(type.omittedStandardFields) ? type.omittedStandardFields : []);
  const configuredKeys = new Set(configured.map((field) => field.key));
  const configuredColumns = new Set(configured.map((field) => field.storesIn).filter(Boolean));

  const standard: FieldDef[] = [];
  const seen = new Set<string>();
  for (const field of blocks.flat()) {
    if (seen.has(field.key) || omitted.has(field.key) || configuredKeys.has(field.key) || (field.storesIn && configuredColumns.has(field.storesIn))) {
      continue;
    }
    seen.add(field.key);
    standard.push({ ...field, required: false, origin: "standard" });
  }

  return [...configured, ...standard].filter((field) => !field.storesIn || !COLLECTED_ELSEWHERE.has(field.storesIn));
}

/** Keys of every field that (transitively) depends on `key`. */
export function descendantsOf(fields: FieldDef[], key: string): FieldDef[] {
  const result: FieldDef[] = [];
  const queue = [key];
  while (queue.length > 0) {
    const parent = queue.shift() as string;
    for (const field of fields) {
      if (field.dependsOn === parent && !result.includes(field)) {
        result.push(field);
        queue.push(field.key);
      }
    }
  }
  return result;
}
