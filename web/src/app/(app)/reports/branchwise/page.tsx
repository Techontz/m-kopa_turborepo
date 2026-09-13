"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, PrintButton, SearchButton, TotalsRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface BranchRow {
  branch_id: number;
  branch: string;
  receivable: number;
  receivable_principal: number;
  receivable_interest: number;
  received: number;
  received_principal: number;
  received_interest: number;
  pending: number;
  reserve: number;
}

const AMOUNTS: Array<[keyof BranchRow, string]> = [
  ["receivable", "Total Receivable"],
  ["receivable_principal", "Receivable Pricipal"],
  ["receivable_interest", "Receivable Intrest"],
  ["received", "Total Received"],
  ["received_principal", "Received Pricipal"],
  ["received_interest", "Received Interest"],
  ["pending", "Total Pending"],
  ["reserve", "Reserve"],
];

/** Report → Branch Wise Report (live admin/blanchiwise_report): whole loan book, or a date range via the filter. */
export default function BranchwisePage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<BranchRow>>("reports/branchwise", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Branchwise Loan Summary"]} />

      <Card title="Branchwise Loan Summary" actions={<><SearchButton onClick={() => setFiltering(true)} /><PrintButton /></>}>
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.branch_id}
          columns={[
            { key: "branch", header: "Branch Name", render: (row) => row.branch.toUpperCase() },
            ...AMOUNTS.map(([key, header]) => ({ key, header, render: (row: BranchRow) => money(row[key] as number) })),
          ]}
          footer={data && <TotalsRow cells={AMOUNTS.map(([key]) => money(data.totals[key]))} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Transaction" onApply={setFilters} />
    </>
  );
}
