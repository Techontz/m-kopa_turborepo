"use client";

import { useState } from "react";

import { cleanQuery, FilterModal, SearchButton, StatusBadge, TotalsRow, type LoanReportRow, type ReportFilters, type ReportRows } from "@/components/reports/ReportKit";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

const STATUSES = ["PENDING", "APROVED", "DISBURSED", "ACTIVE", "DONE", "DEFALT"];

/**
 * Report → Loan Collection (live admin/loan_collection). Remain Amount = outstanding principal + interest (+ insurance);
 * Penart Amount = unpaid penalty (allocation Principal → Penalty → Interest).
 */
export default function LoanCollectionPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data, isLoading } = useApi<ReportRows<LoanReportRow>>("reports/collection", cleanQuery(filters));

  return (
    <>
      <PageHeader crumbs={["Report", "Loan Collection"]} />

      <Card title="Loan Collection" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={data?.rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch Name", render: (row) => row.branch?.toUpperCase() },
            { key: "customer", header: "Customer Name" },
            { key: "employee", header: "Employee", render: (row) => row.employee?.toUpperCase() },
            { key: "total_payable", header: "Loan Amount", render: (row) => money(row.total_payable) },
            { key: "restoration", header: "Collection", render: (row) => money(row.restoration) },
            { key: "paid", header: "Paid Amount", render: (row) => money(row.paid) },
            { key: "remain", header: "Remain Amount", render: (row) => money(row.remain) },
            { key: "penalty", header: "Penart Amount", render: (row) => money(row.penalty) },
            { key: "end_date", header: "End Date" },
            { key: "status", header: "Status", render: (row) => <StatusBadge label={row.status} tone={row.status_badge} /> },
          ]}
          footer={data && <TotalsRow cells={["", "", "", money(data.totals.total_payable), "", money(data.totals.paid), money(data.totals.remain), money(data.totals.penalty), "", ""]} />}
        />
      </Card>

      <FilterModal open={filtering} onClose={() => setFiltering(false)} title="Filter Loan Collection" withDates={false} branchPlaceholder="---Select Branch---" onApply={setFilters}>
        {(form, setForm) => (
          <Field label="Loan Status" className="col-md-12">
            <select className="form-control" value={form.loan_status ?? ""} onChange={(e) => setForm({ ...form, loan_status: e.target.value })} required>
              <option value="">Select Loan Status</option>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </Field>
        )}
      </FilterModal>
    </>
  );
}
