"use client";

import Link from "next/link";
import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, StatusBadge, TotalsRow, type LoanReportRow, type ReportFilters, type Totals } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

type FileRow = LoanReportRow & { months: Record<string, number> };

interface FileReport {
  rows: FileRow[];
  months: Array<{ number: number; name: string }>;
  totals: Totals;
  year: number;
  years: number[];
}

/** Report → File (live admin/collection_data): loans with collections in a year, one column per collection month. */
export default function FileReportPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<FileReport>("reports/file", cleanQuery(filters));

  const columns: Column<FileRow>[] = [
    { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
    { key: "branch", header: "Branch Name" },
    { key: "customer", header: "Customer Name" },
    { key: "phone", header: "Phone Number" },
    { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
    { key: "duration", header: "Duration Type" },
    { key: "restoration", header: "Collection", render: (row) => money(row.restoration) },
    { key: "paid", header: "Paid Amount", render: (row) => money(row.paid) },
    { key: "remain", header: "Remain Amount", render: (row) => money(row.remain) },
    { key: "withdrawal_date", header: "Withdrawal Date" },
    { key: "status", header: "Loan Status", render: (row) => <StatusBadge label={row.status} tone={row.status_badge} /> },
    ...(data?.months ?? []).map((month) => ({
      key: `month_${month.number}`,
      header: month.name,
      value: (row: FileRow) => row.months[month.number] ?? 0,
      render: (row: FileRow) => money(row.months[month.number] ?? 0),
    })),
  ];

  return (
    <>
      <PageHeader crumbs={["Report", "File"]} />

      <Card
        title="File"
        actions={
          <>
            <SearchButton onClick={() => setFiltering(true)} />
            <Link href="/reports/file/new-loans" className="btn btn-sm btn-warning ml-1" title="New Loan"><i className="icon-drawer" /></Link>
          </>
        }
      >
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={columns}
          footer={data && <TotalsRow cells={[...Array(10).fill(""), ...data.months.map((month) => money(data.totals[`month_${month.number}`]))]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Collection" withDates={false} withAll={false} initial={{ year: String(new Date().getFullYear()), loan_status: "ALL" }} onApply={setFilters}>
        {(form, setForm) => (
          <>
            <Field label="*Select Year:" className="col-md-6">
              <select className="form-control" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} required>
                <option value="">Select Year</option>
                {(data?.years ?? []).map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </Field>
            <Field label="*Status:" className="col-md-6">
              <select className="form-control" value={form.loan_status ?? ""} onChange={(e) => setForm({ ...form, loan_status: e.target.value })} required>
                <option value="">Select Status</option>
                {["ALL", "ACTIVE", "CLOSED", "DEFAULT"].map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
          </>
        )}
      </FilterModal>
    </>
  );
}
