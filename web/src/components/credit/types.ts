/**
 * Payload of the Credit Assessment Engine (api: App\Services\Credit\CreditAssessment, spec §36 – §44, §63).
 *
 * Two shapes reach the web:
 *  - a PREVIEW (`stored: false`) — CreditAssessment::for(), every panel at the top level, no `id` / `assessed_by`;
 *  - a STORED snapshot (`stored: true`) — CreditAssessment::present(), which flattens loan_assessments.analysis back to
 *    the top level. A snapshot's analysis panels can be missing (an older row), so every panel is optional here.
 */

export type FactorGroup = "individual" | "contextual" | "supporting";
export type FactorDirection = "positive" | "negative" | "neutral";

/** CreditFactor::toArray(). */
export interface CreditFactor {
  key: string;
  label: string;
  group: FactorGroup;
  /** share of the 100-point score (0 – 1) */
  weight: number;
  /** normalised reading (0 – 1) */
  value: number;
  /** points added to the score */
  contribution: number;
  max_contribution: number;
  direction: FactorDirection;
  summary: string;
  evidence: {
    sources: string[];
    data: Record<string, unknown>;
    notes: string[];
  };
}

/** CreditAssessment::overrides(). */
export interface CreditOverride {
  key: string;
  ratio: number;
  reason: string;
}

/** CreditAssessment::recommend() minus `limits`. */
export interface CreditSteps {
  score_ratio: number;
  score_amount: number;
  capacity_amount: number | null;
  override_ratio: number | null;
  override_amount: number | null;
  before_rounding: number;
  rounded: number;
  final: number;
}

/** CreditAssessment::applyProductLimits() (§44). */
export interface CreditLimits {
  product: string | null;
  product_min: number | null;
  product_max: number | null;
  scored: boolean;
  role: string;
  clamped: boolean;
  clamp_reason: string | null;
}

/** CustomerCreditProfile::capacity() + CreditAssessment::capacityPanel(). */
export interface CreditCapacity {
  income_field: string | null;
  monthly_income: number;
  income_known: boolean;
  dependents: number;
  dependent_share: number;
  household_cost: number;
  existing_monthly_obligation: number;
  disposable_income: number;
  sustainable_monthly_instalment: number;
  debt_to_income: number | null;
  expected_maturity_date?: string;
  income_ends_before_maturity?: Record<string, string> | string[];
  expected_monthly_instalment: number;
  capacity_cover: number | null;
  external_lender_data: string;
  [key: string]: unknown;
}

/** CreditAssessment::contextualInfluence() (§39 – §41). Contribution and cap are in score points. */
export interface CreditContextualInfluence {
  factors: string[];
  contribution: number;
  cap: number;
  max_contribution: number;
  within_cap: boolean;
}

/** CreditAssessment::summary() (§37A). */
export interface CreditSummary {
  requested_amount: number;
  recommended_amount: number;
  difference: number;
  score: number;
  risk_band: string;
  risk_band_label: string;
  previous_loans: number;
  completed_loans: number;
  late_instalments: number;
  loans_in_default: number;
  write_offs: number;
  current_outstanding: number;
  previous_topups: number;
  previous_offset_amount: number;
  existing_obligations: number;
  monthly_income: number;
  sustainable_monthly_instalment: number;
  customer_contribution: number;
  loan_product: string | null;
  loan_product_scored: false;
}

export interface CreditAssessment {
  /** loan_assessments.id — stored snapshots only */
  id?: number;
  stored: boolean;
  loan_id: number;
  loan_number?: string;
  customer_id: number;
  customer?: string;
  customer_type?: string | null;
  requested_amount: number;
  recommended_amount: number;
  recommended_ratio: number;
  score: number;
  risk_band: string;
  risk_band_label?: string;
  advisory: true;
  engine_version: string;
  assessed_at: string | null;
  /** stored snapshots only; null when recorded by the system */
  assessed_by?: string | null;
  as_of?: string;
  excluded_factors: string[] | null;
  excluded_factor_reasons?: Record<string, string>;
  weights?: Record<string, number>;
  caps?: Record<string, number>;
  contextual_influence?: CreditContextualInfluence;
  factors: CreditFactor[] | null;
  capacity?: CreditCapacity;
  limits: CreditLimits | null;
  overrides: CreditOverride[] | null;
  steps: CreditSteps | null;
  summary?: CreditSummary;
  explanation: string | null;
}

/** One row of GET loans/credit-assessments/queue (§63). */
export interface CreditQueueRow {
  loan_id: number;
  loan_number: string;
  status: string;
  status_label: string;
  customer_id: number;
  customer: string | null;
  customer_type: string | null;
  branch: string | null;
  applied_at: string | null;
  requested_amount: number;
  assessment: {
    id: number;
    recommended_amount: number;
    score: number;
    risk_band: string;
    risk_band_label?: string | null;
    assessed_at: string | null;
    explanation: string | null;
    advisory: true;
  } | null;
}

export interface CreditQueueMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
