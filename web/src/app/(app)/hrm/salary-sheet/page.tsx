"use client";

import Link from "next/link";
import { useState } from "react";

import { currentMonth, FilterModal, HeaderButton, statusTone, sum, type Filters } from "@/components/hrm/common";
import type { SalaryPayment } from "@/components/hrm/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface Row {
  employee_id: number;
  employee: string;
  branch: string | null;
  salary_type_label: string | null;
  base_salary: number;
  commission: number;
  allowance: number;
  gross: number;
  staff_fund: number;
  salary_advance: number;
  deduction: number;
  loan_restoration: number;
  total_deductions: number;
  take_home: number;
  phone: string;
  account_name: string | null;
  account_number: string | null;
  paying_account: string;
}

interface Sheet {
  period: string;
  period_label: string;
  period_closed: boolean;
  run: null | { id: number; status: string; commission_status: string | null; total_gross: number; total_net: number; prepared_by: string | null; approved_by: string | null; approved_at: string | null; paid_by: string | null; paid_at: string | null };
  rows: Row[];
}

const MONEY_COLUMNS: [keyof Row, string][] = [
  ["base_salary", "Salary Amount"],
  ["commission", "Commission"],
  ["allowance", "Allowance"],
  ["staff_fund", "Staff Fund"],
  ["salary_advance", "Salary Advance"],
  ["deduction", "Deduction"],
  ["loan_restoration", "Loan Restoration"],
  ["take_home", "Take Home"],
];

function downloadCsv(sheet: Sheet) {
  const header = ["S/No.", "Staff name", "Branch", ...MONEY_COLUMNS.map(([, label]) => label), "Phone no", "Account name", "Account no"];
  const lines = sheet.rows.map((row, index) => [index + 1, row.employee, row.branch ?? "", ...MONEY_COLUMNS.map(([key]) => row[key]), row.phone, row.account_name ?? "", row.account_number ?? ""]);
  const csv = [header, ...lines].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = `salary-sheet-${sheet.period}.csv`;
  link.click();
}

export default function SalarySheetPage() {
  const { can } = useAuth();
  const [period, setPeriod] = useState(currentMonth());
  const [modal, setModal] = useState<"pay" | "paid" | "filter" | null>(null);
  const [paidFilters, setPaidFilters] = useState<Filters>({});
  const { data: sheet, isLoading } = useApi<Sheet>("hrm/payroll", { period });
  const { data: payments } = useApi<SalaryPayment[]>(modal === "paid" ? "hrm/salary-payments" : null, { from: paidFilters.from, to: paidFilters.to });

  const generate = useAction<{ period: string }>("post", "hrm/payroll/generate");
  const approve = useAction<{ id: number }>("post", (body) => `hrm/payroll/${body.id}/approve`);
  const pay = useAction<{ id: number; ac_id: string }>("post", (body) => `hrm/payroll/${body.id}/pay`);

  const run = sheet?.run;
  const rows = sheet?.rows;
  const title = `Staff Salary Sheet / ${new Date(`${period}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

  return (
    <>
      <PageHeader crumbs={["HRM", "Salary Sheet"]} />

      <Card
        title={title}
        actions={
          <>
            {run?.status === "approved" && can("payroll.pay") && <HeaderButton icon="icon-pencil" title="pay salary" onClick={() => setModal("pay")} />}
            <HeaderButton icon="icon-list" title="salary statement" onClick={() => setModal("paid")} />
            <HeaderButton title="filter" onClick={() => setModal("filter")} />
            <HeaderButton icon="icon-printer" tone="info" title="print" onClick={() => window.print()} />
            <HeaderButton icon="icon-cloud-download" tone="secondary" title="download" onClick={() => sheet && downloadCsv(sheet)} />
          </>
        }
      >
        <div className="row mb-3 align-items-end">
          <Field label="Month:" className="col-lg-3 col-6">
            <input type="month" className="form-control" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          </Field>
          <div className="col-lg-9 col-12 mb-2">
            Payroll status: {run ? <Badge tone={statusTone(run.status)}>{run.status.toUpperCase()}</Badge> : <Badge tone="warning">NOT GENERATED (PREVIEW)</Badge>}{" "}
            {sheet && !sheet.period_closed && <Badge tone="danger">Commission: period not closed</Badge>}
            {run?.prepared_by && <small className="ml-2">Prepared: {run.prepared_by}</small>}
            {run?.approved_by && <small className="ml-2">Approved: {run.approved_by} ({run.approved_at})</small>}
            {run?.paid_by && <small className="ml-2">Paid: {run.paid_by} ({run.paid_at})</small>}
            <span className="float-right">
              {can("payroll.approve") && (!run || run.status === "draft") && (
                <button type="button" className="btn btn-sm btn-primary mr-1" disabled={generate.isPending} onClick={() => generate.mutate({ period })}>{run ? "Re-generate" : "Generate Payroll"}</button>
              )}
              {can("payroll.approve") && run?.status === "draft" && (
                <button type="button" className="btn btn-sm btn-success" disabled={approve.isPending} onClick={async () => (await confirmAction("Approve payroll?", "Salaries can not be changed after approval")) && approve.mutate({ id: run.id })}>Approve Payroll</button>
              )}
            </span>
          </div>
        </div>

        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.employee_id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Staff name", className: "text-nowrap", render: (row) => <span title={row.salary_type_label ?? ""}>{row.employee}</span> },
            ...MONEY_COLUMNS.map(([key, label]) => ({ key, header: label, render: (row: Row) => money(row[key] as number) })),
            { key: "phone", header: "Phone no" },
            { key: "account_name", header: "Account name" },
            { key: "account_number", header: "Account no" },
            { key: "paying_account", header: "Paid from" },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              {MONEY_COLUMNS.map(([key]) => <td key={key}><b>{money(sum(rows, (row) => row[key] as number))}</b></td>)}
              <td /><td /><td /><td />
            </tr>
          }
        />
      </Card>

      <Modal open={modal === "pay"} onClose={() => setModal(null)} title="Pay Salary" submitLabel="Pay" submitting={pay.isPending} onSubmit={() => run && pay.mutate({ id: run.id, ac_id: "interest" }, { onSuccess: () => setModal(null) })}>
        <span>Account:</span>
        <select className="form-control" required defaultValue="interest">
          <option value="interest">INTEREST ACC</option>
        </select>
        <small className="text-muted">Branch staff are paid from their branch INTEREST ACC, HQ staff from the COMPANY ACCOUNT. Take home: <b>{money(sum(rows, (row) => row.take_home))}</b></small>
      </Modal>

      <Modal open={modal === "paid"} onClose={() => setModal(null)} title="Salary Paid" size="xl">
        <div className="mb-2 text-right"><HeaderButton title="filter" onClick={() => setModal("filter")} /></div>
        <DataTable
          rows={payments}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "employee", header: "Staff name" },
            { key: "salary", header: "Salary Amount", render: (row) => money(row.salary) },
            { key: "commission", header: "Commission", render: (row) => money(row.commission) },
            { key: "salary_advance", header: "Salary Advance", render: (row) => money(row.salary_advance) },
            { key: "allowance", header: "Allowance", render: (row) => money(row.allowance) },
            { key: "staff_fund", header: "Staff Fund", render: (row) => money(row.staff_fund) },
            { key: "deduction", header: "Deduction", render: (row) => money(row.deduction) },
            { key: "loan_restoration", header: "Loan Restoration", render: (row) => money(row.loan_restoration) },
            { key: "take_home", header: "Take Home", render: (row) => money(row.take_home) },
            { key: "phone", header: "Phone no" },
            { key: "account_name", header: "Account name" },
            { key: "account_number", header: "Account no" },
            { key: "paid_on", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: (row) => <Link className="btn btn-sm btn-primary" href={`/hrm/salary-sheet/payslip/${row.id}`} title="Payslip"><i className="icon-printer" /></Link> },
          ]}
        />
      </Modal>

      <FilterModal open={modal === "filter"} withBranch={false} onClose={() => setModal("paid")} onApply={(filters) => { setPaidFilters(filters); setModal("paid"); }} />
    </>
  );
}
