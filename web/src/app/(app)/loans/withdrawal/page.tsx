"use client";

import { useState } from "react";

import type { Loan } from "@/components/loans/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { money, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface Filters {
  from?: string;
  to?: string;
  branch_id?: string;
  loan_status?: string;
}

const STATUSES = ["PENDING", "APROVED", "DISBURSED", "ACTIVE", "DONE", "DEFALT", "ALL"];

/** Display text for the filter values the API expects (values keep the live spelling). */
const STATUS_LABELS: Record<string, string> = { APROVED: "APPROVED", DEFALT: "DEFAULT" };

/**
 * Loan → Disbursement (live loan_withdrawal "Loan Withdrawal"): loans whose money reached the customer in the period (default today),
 * grouped All / Monthly / Weekly / Daily. "Method" is the disbursement channel (Vodacom, Airtel, bank or cash).
 */
export default function LoanWithdrawalPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Filters>({ from: "", to: "", branch_id: "", loan_status: "" });
  const { data, isLoading } = useApi<Loan[]>("loans/withdrawals", { ...filters, loan_status: filters.loan_status === "ALL" ? undefined : filters.loan_status });

  const groups = [
    { title: "All", rows: data },
    { title: "Monthly", rows: data?.filter((row) => row.duration === "monthly") },
    { title: "Weekly", rows: data?.filter((row) => row.duration === "weekly") },
    { title: "Daily", rows: data?.filter((row) => row.duration === "daily") },
  ];

  return (
    <>
      <PageHeader crumbs={["Loan", "Disbursement"]} right={<button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><i className="icon-calendar" /> Filter</button>} />
      {groups.map((group) => (
        <Card key={group.title} title={group.title}>
          <DataTable
            rows={group.rows}
            loading={isLoading}
            rowKey={(row) => row.id}
            footer={
              <tr>
                <th colSpan={3}>TOTAL:</th>
                <th>{money((group.rows ?? []).reduce((sum, row) => sum + row.amount_approved, 0))}</th>
                <th />
                <th>{money((group.rows ?? []).reduce((sum, row) => sum + row.total_payable, 0))}</th>
                <th colSpan={4} />
                <th>{money((group.rows ?? []).reduce((sum, row) => sum + row.loan_fee, 0))}</th>
                <th colSpan={3} />
              </tr>
            }
            columns={[
              { key: "customer_name", header: "Customer Name" },
              { key: "branch", header: "Branch Name" },
              { key: "loan_number", header: "Loan Ac" },
              { key: "amount_approved", header: "Amount Disbursed", render: (row) => money(row.amount_approved) },
              { key: "interest_rate", header: "Interest", render: (row) => percent(row.interest_rate) },
              { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
              { key: "disbursement_channel", header: "Method", render: (row) => (row.disbursement_channel ?? "cash").toUpperCase() },
              { key: "duration_label", header: "Duration Type" },
              { key: "sessions", header: "Number of Repayment" },
              { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
              { key: "loan_fee", header: "Loan Fee", render: (row) => money(row.loan_fee) },
              { key: "withdrawn_at", header: "Disbursement Date" },
              { key: "end_date", header: "End Date" },
              { key: "status_label", header: "Action", render: (row) => <span className={`badge badge-${row.status_badge}`}>{row.status_label}</span> },
            ]}
          />
        </Card>
      ))}

      <Modal open={open} onClose={() => setOpen(false)} title="Filter" submitLabel="Filter" onSubmit={() => { setFilters(form); setOpen(false); }}>
        <div className="row">
          <Field label="From" required className="col-md-6"><input type="date" className="form-control" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required /></Field>
          <Field label="To" required className="col-md-6"><input type="date" className="form-control" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required /></Field>
          <Field label="Select Branch" required className="col-md-12">
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" query={{ with_all: 1 }} value={form.branch_id} onChange={(value) => setForm({ ...form, branch_id: value ?? "" })} />
          </Field>
          <Field label="Loan Status" required className="col-md-12">
            <select className="form-control" value={form.loan_status} onChange={(e) => setForm({ ...form, loan_status: e.target.value })} required>
              <option value="">Select Loan Status</option>
              {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>)}
            </select>
          </Field>
        </div>
      </Modal>
    </>
  );
}
