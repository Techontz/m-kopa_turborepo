"use client";

import { useState } from "react";

import { PaymentFilterModal, SearchButton, total, type PaymentFilters } from "@/components/payments/PaymentFilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

interface PaidRow {
  id: number;
  customer: string | null;
  branch: string | null;
  amount: number;
  paid_on: string;
}

/** Penalty → Paid Penalty List (live admin/penart_paid_list). */
export default function PaidPenaltyPage() {
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [filtering, setFiltering] = useState(false);
  const { data: rows, isLoading } = useApi<PaidRow[]>("penalties/paid", { branch_id: filters.branch_id, from: filters.from, to: filters.to });

  return (
    <>
      <PageHeader crumbs={["Penalty", "Paid Penalty List"]} />

      <Card title="Paid Penalty List" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Paid Amount", render: (row) => money(row.amount) },
            { key: "paid_on", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: () => null },
          ]}
          footer={
            <tr>
              <td><b>TOTAL</b></td>
              <td />
              <td />
              <td><b>{money(total(rows, (row) => row.amount))}</b></td>
              <td />
              <td />
            </tr>
          }
        />
      </Card>

      <PaymentFilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} />
    </>
  );
}
