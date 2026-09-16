"use client";

import { Fragment, useState, type ReactNode } from "react";

import { directionTone, evidenceValue, humanize, ratio, riskBandLabel, riskBandTone } from "@/components/credit/format";
import type { CreditAssessment, CreditFactor } from "@/components/credit/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/** Who may re-run and store an assessment (CreditAssessmentController::store). */
export const CREDIT_REASSESS_PERMISSIONS = ["loans.credit_review", "loans.approve_manager", "loans.apply"];

const GROUP_LABEL: Record<string, string> = { individual: "Individual", contextual: "Contextual", supporting: "Supporting" };
const GROUP_TONE: Record<string, "primary" | "warning" | "default"> = { individual: "primary", contextual: "warning", supporting: "default" };

function dateTime(value: string | null | undefined): string {
  return value ? value.slice(0, 16).replace("T", " ") : "—";
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

/** An evidence figure, recursing into nested objects / lists (e.g. DPD buckets). */
function EvidenceValue({ name, value }: { name: string; value: unknown }) {
  if (Array.isArray(value)) {
    return value.length === 0 ? <>—</> : <>{value.map((item, index) => <div key={index}><EvidenceValue name={name} value={item} /></div>)}</>;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length === 0 ? <>—</> : (
      <>
        {entries.map(([key, item]) => (
          <div key={key}><small><b>{humanize(key)}:</b> <EvidenceValue name={key} value={item} /></small></div>
        ))}
      </>
    );
  }
  return <>{evidenceValue(name, value)}</>;
}

function FactorEvidence({ factor }: { factor: CreditFactor }) {
  const data = Object.entries(factor.evidence?.data ?? {});
  return (
    <div className="row">
      <div className="col-md-4">
        <div className="mf-section-title">Sources</div>
        <ul className="pl-3 mb-2">{(factor.evidence?.sources ?? []).map((source) => <li key={source}><small>{source}</small></li>)}</ul>
        {(factor.evidence?.notes ?? []).length > 0 && (
          <>
            <div className="mf-section-title">Notes</div>
            <ul className="pl-3 mb-0">{factor.evidence.notes.map((note) => <li key={note}><small>{note}</small></li>)}</ul>
          </>
        )}
      </div>
      <div className="col-md-8">
        <div className="mf-section-title">Data</div>
        {data.length === 0 ? <small>No figures recorded.</small> : (
          <table className="table table-sm table-bordered mb-0">
            <tbody>
              {data.map(([key, value]) => (
                <tr key={key}><th style={{ width: "45%" }}><small>{humanize(key)}</small></th><td><small><EvidenceValue name={key} value={value} /></small></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** §37B "Why this recommendation?" — every factor, each expandable to the evidence it was computed from. */
function FactorsTable({ factors }: { factors: CreditFactor[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setOpen((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="table-responsive">
      <table className="table table-hover table-custom mf-table mb-0">
        <thead className="thead-info">
          <tr><th /><th>Factor</th><th>Group</th><th className="text-right">Weight</th><th className="text-right">Value</th><th className="text-right">Contribution</th><th>Direction</th><th>Summary</th></tr>
        </thead>
        <tbody>
          {factors.map((factor) => (
            <Fragment key={factor.key}>
              <tr style={{ cursor: "pointer" }} onClick={() => toggle(factor.key)} aria-expanded={!!open[factor.key]}>
                <td><i className={open[factor.key] ? "fa fa-minus-square-o" : "fa fa-plus-square-o"} aria-label={open[factor.key] ? "Hide evidence" : "Show evidence"} /></td>
                <td className="text-nowrap"><b>{factor.label}</b></td>
                <td><Badge tone={GROUP_TONE[factor.group] ?? "default"}>{GROUP_LABEL[factor.group] ?? factor.group}</Badge></td>
                <td className="text-right">{ratio(factor.weight)}</td>
                <td className="text-right">{ratio(factor.value)}</td>
                <td className="text-right text-nowrap">{factor.contribution.toFixed(2)} / {factor.max_contribution.toFixed(2)}</td>
                <td><Badge tone={directionTone(factor.direction)}>{factor.direction.toUpperCase()}</Badge></td>
                <td><small>{factor.summary}</small></td>
              </tr>
              {open[factor.key] && (
                <tr><td /><td colSpan={7} className="bg-light"><FactorEvidence factor={factor} /></td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryModal({ loanId, open, onClose }: { loanId: number; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useApi<CreditAssessment[]>(open ? `loans/${loanId}/credit-assessments` : null);
  return (
    <Modal open={open} onClose={onClose} title="Credit Assessment History" size="lg">
      <DataTable
        rows={data}
        loading={isLoading}
        searchable={false}
        rowKey={(row, index) => row.id ?? index}
        emptyMessage="No assessment has been recorded for this loan yet."
        columns={[
          { key: "assessed_at", header: "Date", render: (row) => dateTime(row.assessed_at) },
          { key: "assessed_by", header: "By", render: (row) => row.assessed_by ?? "System" },
          { key: "requested_amount", header: "Requested", render: (row) => money(row.requested_amount) },
          { key: "recommended_amount", header: "Recommended", render: (row) => money(row.recommended_amount) },
          { key: "score", header: "Score", render: (row) => <>{row.score.toFixed(2)} <Badge tone={riskBandTone(row.risk_band)}>{riskBandLabel(row.risk_band, row.risk_band_label)}</Badge></> },
          { key: "engine_version", header: "Engine" },
        ]}
      />
    </Modal>
  );
}

/**
 * Credit Officer analysis (spec §37 / §43 / §44): the system's advisory recommendation for one loan application with
 * the data behind it. Takes either a stored snapshot or an unstored preview (`stored` flag).
 */
export function CreditAssessmentCard({ loanId, assessment }: { loanId: number; assessment: CreditAssessment | null }) {
  const { can } = useAuth();
  const [history, setHistory] = useState(false);
  const reassess = useAction<void>("post", `loans/${loanId}/credit-assessment`);
  const canReassess = can(CREDIT_REASSESS_PERMISSIONS);

  if (!assessment && !canReassess) {
    return null;
  }

  const actions = (
    <>
      {canReassess && (
        <button type="button" className="btn btn-sm btn-primary mr-1" disabled={reassess.isPending} onClick={() => reassess.mutate()}>
          <i className="icon-refresh" /> {reassess.isPending ? "Please wait..." : "Re-assess"}
        </button>
      )}
      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setHistory(true)}><i className="icon-clock" /> History</button>
    </>
  );

  if (!assessment) {
    return (
      <>
        <Card title="Credit Assessment" actions={actions}>
          <p className="mb-0">No credit assessment is available for this loan. Re-assess to record one — it is advisory only and changes nothing on the loan.</p>
        </Card>
        <HistoryModal loanId={loanId} open={history} onClose={() => setHistory(false)} />
      </>
    );
  }

  const factors = assessment.factors ?? [];
  const scored = factors.filter((factor) => factor.group !== "supporting");
  const supporting = factors.filter((factor) => factor.group === "supporting");
  const overrides = assessment.overrides ?? [];
  const steps = assessment.steps;
  const limits = assessment.limits;
  const capacity = assessment.capacity;
  const context = assessment.contextual_influence;
  const summary = assessment.summary;
  const excludedReasons = assessment.excluded_factor_reasons ?? {};
  const excluded = assessment.excluded_factors ?? Object.keys(excludedReasons);
  const contributionTotal = summary?.customer_contribution ?? (supporting.find((factor) => factor.key === "profitability")?.evidence?.data?.total_contribution as number | undefined);
  const factorLabel = (key: string) => factors.find((factor) => factor.key === key)?.label ?? humanize(key);

  return (
    <>
      <Card title={<>Credit Assessment {assessment.stored ? <Badge tone="success">STORED</Badge> : <Badge tone="warning">PREVIEW — NOT STORED</Badge>}</>} actions={actions}>
        <div className="alert alert-info" role="note">
          <i className="icon-info" /> <b>Advisory only — the Credit Officer decides.</b> This recommendation has changed no status, amount or approval.
        </div>

        {/* §37A Summary */}
        <div className="row text-center mb-3">
          <div className="col-md-3 col-6 mb-2"><small className="text-muted">Requested Amount</small><h4 className="mb-0">TZS {money(assessment.requested_amount)}</h4></div>
          <div className="col-md-3 col-6 mb-2"><small className="text-muted">System Recommended Amount</small><h4 className="mb-0 text-success">TZS {money(assessment.recommended_amount)}</h4><small>{ratio(assessment.recommended_ratio)} of requested</small></div>
          <div className="col-md-3 col-6 mb-2"><small className="text-muted">Score</small><h4 className="mb-0">{assessment.score.toFixed(2)} <small>/ 100</small></h4></div>
          <div className="col-md-3 col-6 mb-2"><small className="text-muted">Risk Band</small><h4 className="mb-0"><Badge tone={riskBandTone(assessment.risk_band)}>{riskBandLabel(assessment.risk_band, assessment.risk_band_label)}</Badge></h4></div>
        </div>
        <p className="mb-2">
          <small className="text-muted">
            Assessed {dateTime(assessment.assessed_at)}
            {assessment.stored && <> by {assessment.assessed_by ?? "System"}</>}
            {assessment.as_of && <> · data as of {assessment.as_of}</>}
            {" "}· engine v{assessment.engine_version}
            {summary?.loan_product && <> · product {summary.loan_product} (not scored)</>}
          </small>
        </p>

        {assessment.explanation && <p className="mb-3">{assessment.explanation}</p>}

        {summary && (
          <>
            <div className="mf-section-title">Customer history</div>
            <dl className="mf-dl mb-3">
              <Row label="Previous loans">{summary.previous_loans}</Row>
              <Row label="Completed loans">{summary.completed_loans}</Row>
              <Row label="Late instalments">{summary.late_instalments}</Row>
              <Row label="Loans in default">{summary.loans_in_default}</Row>
              <Row label="Write-offs">{summary.write_offs}</Row>
              <Row label="Current outstanding">{money(summary.current_outstanding)}</Row>
              <Row label="Existing obligations">{money(summary.existing_obligations)}</Row>
              <Row label="Previous top-ups">{summary.previous_topups}</Row>
              <Row label="Previous offset amount">{money(summary.previous_offset_amount)}</Row>
            </dl>
          </>
        )}

        {overrides.length > 0 && (
          <div className="alert alert-danger">
            <b>Overrides</b>
            <ul className="mb-0 pl-3">
              {overrides.map((override) => (
                <li key={override.key}><b>{humanize(override.key)}</b> (capped at {ratio(override.ratio)} of requested): {override.reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mf-section-title">Why this recommendation?</div>
        {scored.length > 0 ? <FactorsTable factors={scored} /> : <p>No factor breakdown was recorded.</p>}
      </Card>

      <div className="row">
        {capacity && (
          <div className="col-lg-6">
            <Card title="Repayment Capacity">
              <dl className="mf-dl mf-dl-2 mb-0">
                <Row label="Monthly income">{capacity.income_known ? money(capacity.monthly_income) : "Not recorded"}</Row>
                <Row label="Income source">{capacity.income_field ? humanize(capacity.income_field) : "—"}</Row>
                <Row label="Dependants">{capacity.dependents}</Row>
                <Row label="Household cost">{money(capacity.household_cost)}</Row>
                <Row label="Existing monthly obligations">{money(capacity.existing_monthly_obligation)}</Row>
                <Row label="Debt-to-income">{ratio(capacity.debt_to_income)}</Row>
                <Row label="Disposable income">{money(capacity.disposable_income)}</Row>
                <Row label="Sustainable capacity / month">{money(capacity.sustainable_monthly_instalment)}</Row>
                <Row label="Expected instalment / month">{money(capacity.expected_monthly_instalment)}</Row>
                <Row label="Capacity cover">{ratio(capacity.capacity_cover)}</Row>
              </dl>
              {capacity.external_lender_data && <p className="mt-2 mb-0"><small className="text-muted">External lenders: {capacity.external_lender_data}</small></p>}
            </Card>
          </div>
        )}

        {context && (
          <div className="col-lg-6">
            <Card title="Contextual Influence">
              <table className="table table-sm mb-2">
                <thead className="thead-info"><tr><th>Signal</th><th className="text-right">Contribution</th><th className="text-right">Cap</th></tr></thead>
                <tbody>
                  {context.factors.map((key) => {
                    const factor = factors.find((item) => item.key === key);
                    return (
                      <tr key={key}>
                        <td>{factorLabel(key)}</td>
                        <td className="text-right">{factor ? factor.contribution.toFixed(2) : "—"}</td>
                        <td className="text-right">{factor ? factor.max_contribution.toFixed(2) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><th>Total</th><th className="text-right">{context.contribution.toFixed(2)}</th><th className="text-right">{context.cap.toFixed(2)}</th></tr>
                </tfoot>
              </table>
              <p className="mb-0">
                <Badge tone={context.within_cap ? "success" : "danger"}>{context.within_cap ? "WITHIN CAP" : "OVER CAP"}</Badge>{" "}
                <small>Customer type, branch and officer performance together may move the score by at most {context.cap.toFixed(2)} points — group behaviour never replaces the customer&apos;s own history (§39 – §41).</small>
              </p>
            </Card>
          </div>
        )}

        {steps && (
          <div className="col-lg-6">
            <Card title="Calculation Steps">
              <table className="table table-sm mb-0">
                <tbody>
                  <tr><td>1. Score share of request ({ratio(steps.score_ratio)})</td><td className="text-right">{money(steps.score_amount)}</td></tr>
                  <tr><td>2. Repayment capacity limit</td><td className="text-right">{steps.capacity_amount === null ? "Not applied" : money(steps.capacity_amount)}</td></tr>
                  <tr><td>3. Overrides{steps.override_ratio !== null && ` (${ratio(steps.override_ratio)})`}</td><td className="text-right">{steps.override_amount === null ? "None" : money(steps.override_amount)}</td></tr>
                  <tr><td>Before rounding</td><td className="text-right">{money(steps.before_rounding)}</td></tr>
                  <tr><td>4. Rounded</td><td className="text-right">{money(steps.rounded)}</td></tr>
                  <tr>
                    <td>
                      5. Product limit clamp{limits?.product && ` — ${limits.product} (${money(limits.product_min)} – ${money(limits.product_max)})`}
                      {limits?.clamp_reason && <div><small className="text-danger">{limits.clamp_reason}</small></div>}
                    </td>
                    <td className="text-right">{limits?.clamped ? <Badge tone="warning">CLAMPED</Badge> : "No change"}</td>
                  </tr>
                  <tr><th>Recommended amount</th><th className="text-right">{money(steps.final)}</th></tr>
                </tbody>
              </table>
            </Card>
          </div>
        )}

        <div className="col-lg-6">
          {excluded.length > 0 && (
            <Card title="Excluded Factors">
              <ul className="pl-3 mb-0">
                {excluded.map((key) => <li key={key}><b>{humanize(key)}</b>{excludedReasons[key] ? ` — ${excludedReasons[key]}` : ""}</li>)}
              </ul>
              {limits?.role && <p className="mt-2 mb-0"><small className="text-muted">{limits.role}</small></p>}
            </Card>
          )}

          {(supporting.length > 0 || contributionTotal !== undefined) && (
            <Card title={<>Customer Contribution <small className="text-muted">supporting evidence — does not raise the amount</small></>}>
              {contributionTotal !== undefined && <p className="mb-2">Total historical contribution to income: <b>TZS {money(contributionTotal)}</b></p>}
              {supporting.map((factor) => (
                <div key={factor.key}>
                  <p className="mb-2"><small>{factor.summary}</small></p>
                  <FactorEvidence factor={factor} />
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      <HistoryModal loanId={loanId} open={history} onClose={() => setHistory(false)} />
    </>
  );
}
