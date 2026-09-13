"use client";

import Link from "next/link";
import { useState } from "react";

import { sum } from "@/components/hrm/common";
import type { StaffLoan } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

export default function StaffActiveLoanPage() {
  const { can } = useAuth();
  const { data: loans, isLoading } = useApi<StaffLoan[]>("hrm/staff-loans/active");
  const [paying, setPaying] = useState<StaffLoan | null>(null);
  const [history, setHistory] = useState<StaffLoan | null>(null);
  const [amount, setAmount] = useState("");
  const pay = useAction<{ id: number; amount: string }>("post", (body) => `hrm/staff-loans/${body.id}/pay`);

  return (
    <>
      <PageHeader crumbs={["HRM", "Staff Loan"]} />
      <Card title="Staff Active Loan" actions={<Link href="/hrm/staff-loans" className="btn btn-primary btn-sm" title="back"><i className="icon-arrow-left" /></Link>}>
        <DataTable
          rows={loans}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "employee", header: "Staff name" },
            { key: "amount_applied", header: "How loan", render: (row) => money(row.amount_applied) },
            { key: "amount_approved", header: "Loan Approved", render: (row) => money(row.amount_approved) },
            { key: "sessions", header: "No.Repayment", render: (row) => `${row.duration.charAt(0).toUpperCase()}${row.duration.slice(1)} / ${row.sessions}` },
            { key: "total_payable", header: "Loan + interest", render: (row) => money(row.total_payable) },
            { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
            { key: "remaining_amount", header: "Remain Amount", render: (row) => money(row.remaining_amount) },
            { key: "status", header: "Status", render: (row) => <Badge tone="success">{row.status.toUpperCase()}</Badge> },
            { key: "fee", header: "chargers", render: (row) => money(row.fee) },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  {can(["payroll.pay", "hrm.manage"]) && <button type="button" className="btn btn-sm btn-primary mr-1" title="Pay loan" onClick={() => { setPaying(row); setAmount(""); }}><i className="icon-pencil" /></button>}
                  <button type="button" className="btn btn-sm btn-primary" title="Loan Payments" onClick={() => setHistory(row)}><i className="icon-list" /></button>
                </>
              ),
            },
          ]}
          footer={<tr><td>TOTAL</td><td /><td /><td /><td>{money(sum(loans, (row) => row.amount_approved))}</td><td /><td>{money(sum(loans, (row) => row.total_payable))}</td><td /><td /><td /><td>{money(sum(loans, (row) => row.fee))}</td><td /><td /></tr>}
        />
      </Card>

      <Modal open={paying !== null} onClose={() => setPaying(null)} title="Pay loan" submitLabel="Deposit" submitting={pay.isPending} onSubmit={() => paying && pay.mutate({ id: paying.id, amount }, { onSuccess: () => setPaying(null) })}>
        <div className="row clearfix">
          <Field label="Amount" className="col-md-12 col-12" error={pay.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" max={paying?.remaining_amount} value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
        </div>
      </Modal>

      <Modal open={history !== null} onClose={() => setHistory(null)} title="Loan Payments">
        <DataTable
          rows={history?.payments}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "paid_on", header: "Date" },
          ]}
        />
      </Modal>
    </>
  );
}
