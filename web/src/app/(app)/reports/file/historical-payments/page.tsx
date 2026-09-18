"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { cleanQuery, FilterModal, PrintButton, SearchButton, TotalsRow, type ReportFilters } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Loading } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface HistoricalPaymentRow {
  id: number;
  record_id: number;
  serial_number: number;
  branch: string;
  customer: string;
  phone: string | null;
  status: string | null;
  year: number;
  month: number;
  month_name: string;
  amount: number;
  source: string;
}

interface HistoricalPaymentsReport {
  rows: HistoricalPaymentRow[];
  totals: { amount: number };
  year: number;
  years: number[];
}

/**
 * Report → File → Historical Payments: the month-by-month amounts behind the historical rows of the File report
 * (e.g. the Kakonko 2022 report), one line per customer row and month. Figures as printed — not repayments.
 */
export default function FileHistoricalPaymentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoricalPayments />
    </Suspense>
  );
}

function HistoricalPayments() {
  const initialYear = useSearchParams().get("year") ?? undefined;
  const [filters, setFilters] = useState<ReportFilters>(initialYear ? { year: initialYear } : {});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<HistoricalPaymentsReport>("reports/file/historical-payments", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "File", "Historical Payments"]} />

      <div className="alert alert-info">
        Amounts paid per month as printed on imported historical File reports. They are records carried over from the old system — not receipts, repayments or
        cash in this system.
      </div>

      <Card
        title={`HISTORICAL PAYMENTS / Year (${data?.year ?? ""})`}
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
          pageSize={25}
          emptyMessage="No historical File report has been imported for this year."
          columns={[
            { key: "month", header: "Month", value: (row) => row.month, render: (row) => `${row.month_name} / ${row.year}` },
            { key: "serial_number", header: "S/No.", render: (row) => `${row.serial_number}.` },
            { key: "branch", header: "Branch Name" },
            { key: "customer", header: "Customer Name" },
            { key: "phone", header: "Phone Number" },
            { key: "status", header: "Loan Status" },
            { key: "amount", header: "Amount Paid", render: (row) => money(row.amount) },
            { key: "source", header: "Source" },
          ]}
          footer={data && <TotalsRow cells={["", "", "", "", "", money(data.totals.amount), ""]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter" withDates={false} withAll={false} branchPlaceholder="---Select Branch---" initial={{ year: String(data?.year ?? "") }} onApply={setFilters}>
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
