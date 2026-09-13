"use client";

import Link from "next/link";
import { useState } from "react";

import type { Loan, LoanDetail } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

/** Loan → Loan Disbursed (live disburse_loan): running loans with agreement upload, repayment schedule and agreement. */
export default function LoanDisbursedPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<Loan[]>("loans", { stage: "disbursed" });
  const [uploading, setUploading] = useState<Loan | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [scheduleOf, setScheduleOf] = useState<Loan | null>(null);
  const { data: detail } = useApi<LoanDetail>(scheduleOf ? `loans/${scheduleOf.id}` : null);
  const upload = useAction<FormData>("post", () => `loans/${uploading?.id}/agreement`);

  const rows = data ?? [];
  const total = (key: "amount_approved" | "total_payable") => rows.reduce((sum, row) => sum + Number(row[key]), 0);

  return (
    <>
      <PageHeader crumbs={["Loan", "Loan Disbursed"]} />
      <Card title="Loan Disbursed List">
        <DataTable
          rows={data}
          loading={isLoading}
          rowKey={(row) => row.id}
          footer={
            <tr>
              <th colSpan={4}>TOTAL:</th>
              <th>{money(total("amount_approved"))}</th>
              <th />
              <th>{money(total("total_payable"))}</th>
              <th colSpan={8} />
            </tr>
          }
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer_name", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "loan_number", header: "Loan Ac", render: (row) => <Link href={`/loans/${row.id}`}>{row.loan_number}</Link> },
            { key: "amount_approved", header: "Loan Disbursed", render: (row) => money(row.amount_approved) },
            { key: "interest_rate", header: "Loan Interest", render: (row) => percent(row.interest_rate) },
            { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
            { key: "duration_label", header: "Restoration Type" },
            { key: "sessions", header: "Number of Repayment" },
            { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
            { key: "source", header: "Disbursement Source", value: (row) => row.latest_disbursement?.source_label ?? "", render: (row) => row.latest_disbursement?.source_label ?? "—" },
            { key: "journal_reference", header: "Transaction Ref", value: (row) => row.latest_disbursement?.journal_reference ?? "", render: (row) => row.latest_disbursement?.journal_reference ?? "—" },
            { key: "withdrawn_at", header: "Date" },
            { key: "status_label", header: "Status", render: (row) => <span className={`badge badge-${row.status_badge}`}>{row.status_label}{row.days_past_due > 0 ? ` (${row.days_past_due} DPD)` : ""}</span> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {can(["loans.apply", "loans.approve_manager", "loans.disburse"]) && (
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Upload Loan Agreement" onClick={() => { setUploading(row); setFile(null); }}><i className="icon-cloud-upload" /></button>
                  )}
                  <button type="button" className="btn btn-sm btn-icon btn-info mr-1" title="Repayment schedule" onClick={() => setScheduleOf(row)}><i className="icon-calendar" /></button>
                  {row.agreement_file && <a href={row.agreement_file} target="_blank" rel="noreferrer" className="btn btn-sm btn-icon btn-success mr-1" title="Loan agreement"><i className="icon-doc" /></a>}
                  <Link href={`/loans/${row.id}?print=agreement`} className="btn btn-sm btn-icon btn-secondary" title="Print agreement"><i className="icon-printer" /></Link>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={uploading !== null}
        onClose={() => setUploading(null)}
        title="Upload Loan Agreement"
        submitLabel="Upload"
        submitting={upload.isPending}
        onSubmit={() => {
          const form = new FormData();
          if (file) {
            form.append("attach", file);
          }
          upload.mutate(form, { onSuccess: () => setUploading(null) });
        }}
      >
        <Field label="Loan Agreement (PDF)" required className="col-md-12" error={upload.fieldError("attach")}>
          <input type="file" accept="application/pdf" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </Field>
      </Modal>

      <Modal open={scheduleOf !== null} onClose={() => setScheduleOf(null)} title={`Repayment schedule — ${scheduleOf?.customer_name ?? ""}`} size="lg">
        <DataTable
          rows={detail?.loan.id === scheduleOf?.id ? detail?.schedules : undefined}
          loading={detail?.loan.id !== scheduleOf?.id}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "due_date", header: "Date" },
            { key: "amount", header: "Restoration", render: (row) => money(row.amount) },
            { key: "paid_amount", header: "Received", render: (row) => money(row.paid_amount) },
            { key: "pending", header: "Pending", render: (row) => money(row.pending) },
          ]}
        />
      </Modal>
    </>
  );
}
