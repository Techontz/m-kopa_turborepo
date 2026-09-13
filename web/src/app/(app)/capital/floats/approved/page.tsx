"use client";

import { useState } from "react";

import { DateFilterModal, totalAmount, type DateFilters, type FloatTransfer } from "@/components/capital/DateFilterModal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Live admin/aproved_float — approved branch → branch floats (today unless filtered). */
export default function ApprovedFloatPage() {
  const [filters, setFilters] = useState<DateFilters | null>(null);
  const [open, setOpen] = useState(false);
  const { data: transfers, isLoading } = useApi<FloatTransfer[]>("capital/floats/approved", filters ? { from: filters.from, to: filters.to } : undefined);

  return (
    <>
      <PageHeader crumbs={["Float", "Approved Float"]} />
      <Card title="Transaction List Approved" actions={<button type="button" className="btn btn-sm btn-icon btn-primary" onClick={() => setOpen(true)}><i className="icon-magnifier" /></button>}>
        <DataTable
          rows={transfers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "from_branch", header: "From Branch" },
            { key: "to_branch", header: "To Branch" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "status", header: "Status", render: () => <Badge tone="success">Approved</Badge> },
            { key: "date", header: "Date" },
          ]}
          footer={<tr><td>TOTAL:</td><td /><td /><td><b>{money(totalAmount(transfers))}</b></td><td /><td /></tr>}
        />
      </Card>
      <DateFilterModal open={open} title="Filter By" onClose={() => setOpen(false)} onApply={setFilters} />
    </>
  );
}
