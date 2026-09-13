"use client";

import Link from "next/link";
import { useState } from "react";

import { cleanQuery, FilterModal, PrintButton, SearchButton, StatusBadge, TotalsRow, type LoanReportRow, type ReportFilters, type Totals } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface NewLoansReport {
  rows: LoanReportRow[];
  totals: Totals;
  year: number;
  years: number[];
}

/** Report → File → New Loan (live "FILE REPORT NEW LOAN / Year"): loans cashed out in the year. */
export default function FileNewLoansPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<NewLoansReport>("reports/file/new-loans", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "File"]} />

      <Card
        title={`FILE REPORT NEW LOAN / Year (${data?.year ?? new Date().getFullYear()})`}
        actions={
          <>
            <SearchButton onClick={() => setFiltering(true)} />
            <Link href="/reports/file" className="btn btn-sm btn-warning ml-1" title="File"><i className="icon-drawer" /></Link>
            <PrintButton />
          </>
        }
      >
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
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
          ]}
          footer={data && <TotalsRow cells={["", "", "", money(data.totals.total_payable), "", money(data.totals.restoration), money(data.totals.paid), money(data.totals.remain), "", ""]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter" withDates={false} withAll={false} branchPlaceholder="---Select Branch---" initial={{ year: String(new Date().getFullYear()) }} onApply={setFilters}>
        {(form, setForm) => (
          <Field label="*Select Year:" className="col-md-12">
            <select className="form-control" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value })} required>
              <option value="">Select Year</option>
              {(data?.years ?? []).map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </Field>
        )}
      </FilterModal>
    </>
  );
}
