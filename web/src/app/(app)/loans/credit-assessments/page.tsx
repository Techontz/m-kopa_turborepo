"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { AccessDenied } from "@/components/customers/AccessDenied";
import { riskBandLabel, riskBandTone } from "@/components/credit/format";
import type { CreditQueueMeta, CreditQueueRow } from "@/components/credit/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";

const CREDIT_QUEUE_PERMISSIONS = ["loans.credit_review", "loans.approve_manager"];

/**
 * Credit Officer dashboard (spec §63): loan applications still awaiting a decision, each with the latest advisory
 * recommendation recorded for it. The analysis itself (§37) opens on the loan page.
 */
export default function CreditAssessmentQueuePage() {
  const { can, isLoading: authLoading } = useAuth();
  const allowed = can(CREDIT_QUEUE_PERMISSIONS);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ["loans/credit-assessments/queue", { page, perPage }],
    queryFn: () => api.get<{ data: CreditQueueRow[]; meta: CreditQueueMeta }>("loans/credit-assessments/queue", { page, per_page: perPage }),
    enabled: allowed,
    placeholderData: keepPreviousData,
  });

  if (!authLoading && !allowed) {
    return <><PageHeader crumbs={["Loan", "Credit Assessment"]} /><AccessDenied /></>;
  }

  const meta = data?.meta;
  const offset = meta ? (meta.current_page - 1) * meta.per_page : 0;

  return (
    <>
      <PageHeader crumbs={["Loan", "Credit Assessment"]} />
      <Card title="Loan Requests Awaiting Analysis">
        <p className="mb-2"><small className="text-muted">Recommendations are advisory only — the Credit Officer decides.</small></p>
        <DataTable
          rows={data?.data}
          loading={isLoading || authLoading}
          searchable={false}
          pageSize={100}
          rowKey={(row) => row.loan_id}
          emptyMessage="No loan application is awaiting analysis."
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${offset + index + 1}.`, sortable: false },
            { key: "loan_number", header: "Loan AC/No", render: (row) => <Link href={`/loans/${row.loan_id}`}>{row.loan_number}</Link> },
            { key: "customer", header: "Customer", render: (row) => row.customer ?? "—" },
            { key: "customer_type", header: "Customer Type", render: (row) => row.customer_type ?? "—" },
            { key: "branch", header: "Branch", render: (row) => row.branch ?? "—" },
            { key: "applied_at", header: "Applied", render: (row) => date(row.applied_at) },
            { key: "requested_amount", header: "Requested", className: "text-right", render: (row) => money(row.requested_amount) },
            { key: "recommended", header: "Recommended", className: "text-right", value: (row) => row.assessment?.recommended_amount ?? null, render: (row) => (row.assessment ? money(row.assessment.recommended_amount) : "—") },
            {
              key: "score",
              header: "Score / Band",
              value: (row) => row.assessment?.score ?? null,
              render: (row) => (row.assessment
                ? <>{row.assessment.score.toFixed(2)} <Badge tone={riskBandTone(row.assessment.risk_band)}>{row.assessment.risk_band_label ?? riskBandLabel(row.assessment.risk_band)}</Badge></>
                : <Badge tone="default">NOT ASSESSED</Badge>),
            },
            { key: "status_label", header: "Status", render: (row) => <Badge tone="info">{row.status_label}</Badge> },
            { key: "action", header: "Action", sortable: false, render: (row) => <Link href={`/loans/${row.loan_id}`} className="btn btn-sm btn-info">View analysis</Link> },
          ]}
        />
        {meta && (
          <div className="mf-pager">
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
              <span>Showing {meta.total === 0 ? 0 : offset + 1} to {Math.min(offset + meta.per_page, meta.total)} of {meta.total} entries</span>
              <select className="form-control form-control-sm" style={{ width: 80 }} value={perPage} aria-label="Rows per page" onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }}>
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <ul className="pagination">
              <li className={`page-item ${meta.current_page <= 1 ? "disabled" : ""}`}>
                <button type="button" className="page-link" disabled={meta.current_page <= 1} onClick={() => setPage(meta.current_page - 1)}>Previous</button>
              </li>
              <li className="page-item active"><span className="page-link">{meta.current_page} / {meta.last_page}</span></li>
              <li className={`page-item ${meta.current_page >= meta.last_page ? "disabled" : ""}`}>
                <button type="button" className="page-link" disabled={meta.current_page >= meta.last_page} onClick={() => setPage(meta.current_page + 1)}>Next</button>
              </li>
            </ul>
          </div>
        )}
      </Card>
    </>
  );
}
