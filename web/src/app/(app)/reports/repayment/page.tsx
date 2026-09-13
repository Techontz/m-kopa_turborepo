"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, TotalsRow, type LoanReportRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Report → Loan Repayment (live admin/repaymant_data): the loan book still being repaid. */
export default function LoanRepaymentPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<LoanReportRow>>("reports/repayment", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Loan Repayment"]} />

      <Card title="Loan Repayment" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "customer", header: <b>Customer Name</b> },
            { key: "branch", header: <b>Branch Name</b> },
            { key: "loan_number", header: <b>Loan Ac</b> },
            { key: "amount_approved", header: <b>Principal</b>, render: (row) => money(row.amount_approved) },
            { key: "interest_amount", header: <b>Interest Amount</b>, render: (row) => money(row.interest_amount) },
            { key: "total_payable", header: <b>Principal + Interest</b>, render: (row) => money(row.total_payable) },
            { key: "duration", header: <b>Loan Duration</b> },
            { key: "sessions", header: <b>Number Of Repayment</b> },
            { key: "withdrawal_date", header: <b>Withdrawal Date</b> },
            { key: "end_date", header: <b>End Date</b> },
          ]}
          footer={data && <TotalsRow label={<b>TOTAL</b>} cells={["", "", <b key="p">{money(data.totals.amount_approved)}</b>, <b key="i">{money(data.totals.interest_amount)}</b>, <b key="t">{money(data.totals.total_payable)}</b>, "", "", "", ""]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Repayment" withDates={false} branchPlaceholder="---Select Branch---" onApply={setFilters} />
    </>
  );
}
