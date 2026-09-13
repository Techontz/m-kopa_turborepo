"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PaneCard, ReportTabs, SearchButton, sumBy, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface ReceivableRow {
  id: number;
  customer: string | null;
  branch: string | null;
  phone: string | null;
  duration: string;
  total_payable: number;
  restoration: number;
  amount: number;
  paid_amount: number;
  pending: number;
  is_paid: boolean;
  employee: string | null;
  date: string;
}

type Tab = "Basic" | "Account" | "General";

const paidBadge = (row: ReceivableRow) => (row.is_paid ? <Badge tone="success">PAID</Badge> : <Badge tone="danger">NOT PAID</Badge>);

/** Report → Today Receivable (live admin/today_recevable_loan): instalments due today (or in the filtered range). */
export default function ReceivablePage() {
  const [tab, setTab] = useState<Tab>("Basic");
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<ReceivableRow>>("reports/receivable", cleanQuery(filters));

  const byDuration = (duration: string) => data?.rows.filter((row) => row.duration === duration);
  const paneRows = tab === "Account" ? byDuration("Weekly") : byDuration("Daily");

  return (
    <>
      <PageHeader crumbs={["Report", "Receivable"]} />
      {/* Live: the "Monthly" tab opens the "All Receivable" pane. */}
      <ReportTabs tabs={[["Basic", "Monthly"], ["Account", "Weekly"], ["General", "Daily"]]} value={tab} onChange={setTab} />

      {tab === "Basic" ? (
        <PaneCard title="All Receivable" actions={<SearchButton onClick={() => setFiltering(true)} />}>
          <DataTable
            rows={data?.rows}
            loading={isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/no", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "customer", header: "Customer" },
              { key: "branch", header: "Branch" },
              { key: "phone", header: "Number" },
              { key: "duration", header: "Duration" },
              { key: "total_payable", header: "Loan", render: (row) => money(row.total_payable) },
              { key: "restoration", header: "Restoration", render: (row) => money(row.restoration) },
              { key: "amount", header: "Receivable Amount", render: (row) => money(row.amount) },
              { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
              { key: "pending", header: "Pending amount", render: (row) => money(row.pending) },
              { key: "status", header: "Status", value: (row) => (row.is_paid ? "PAID" : "NOT PAID"), render: paidBadge },
              { key: "date", header: "Date" },
            ]}
            footer={data && data.rows.length > 0 && <TotalsRow label={<b>TOTAL:</b>} cells={["", "", "", "", "", "", <b key="a">{money(data.totals.amount)}</b>, <b key="p">{money(data.totals.paid_amount)}</b>, <b key="n">{money(data.totals.pending)}</b>, "", ""]} />}
          />
        </PaneCard>
      ) : (
        <Card title={tab === "Account" ? "Weekly Receivable" : "Daily Receivable"}>
          <DataTable
            key={tab}
            rows={paneRows}
            loading={isLoading}
            rowKey={(row) => row.id}
            columns={[
              { key: "sn", header: "S/no", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "customer", header: "Customer" },
              { key: "branch", header: "Branch" },
              { key: "phone", header: "Number" },
              { key: "duration", header: "Duration" },
              { key: "total_payable", header: "Loan", render: (row) => money(row.total_payable) },
              { key: "amount", header: "Receivable Amount", render: (row) => money(row.amount) },
              { key: "employee", header: "Employee" },
              { key: "status", header: "paid status", value: (row) => (row.is_paid ? "PAID" : "NOT PAID"), render: paidBadge },
              { key: "date", header: "Date" },
            ]}
            footer={paneRows && <TotalsRow label={<b>TOTAL:</b>} cells={["", "", "", "", "", <b key="a">{money(sumBy(paneRows, (row) => row.amount))}</b>, "", "", ""]} />}
          />
        </Card>
      )}

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Receivable" initial={{ paid_status: "all" }} onApply={setFilters}>
        {(form, setForm) => (
          <Field label="paid status:" className="col-md-12">
            <select className="form-control" value={form.paid_status ?? ""} onChange={(e) => setForm({ ...form, paid_status: e.target.value })} required>
              <option value="">Select status</option>
              <option value="paid">paid</option>
              <option value="not paid">not paid</option>
              <option value="all">ALL</option>
            </select>
          </Field>
        )}
      </FilterModal>
    </>
  );
}
