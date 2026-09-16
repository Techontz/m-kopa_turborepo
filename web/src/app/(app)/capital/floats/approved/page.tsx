"use client";

import { useState } from "react";

import { DateFilterModal, totalAmount, type DateFilters, type FloatTransfer } from "@/components/capital/DateFilterModal";
import { isReversed, ReversedStatus, ReverseButton } from "@/components/finance/Reversal";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { money } from "@/lib/format";
import { useApi } from "@/lib/hooks";

/** Approved floats: company money (Company A/C, a bank account or the Investment RESERVE A/C) posted to the HQ PRINCIPAL A/C
 * (today unless filtered). Branches never receive float. */
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
            { key: "from_account", header: "From Account" },
            { key: "to_account", header: "To Account" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "status", header: "Status", render: (row) => (isReversed(row) ? <ReversedStatus row={row} /> : <Badge tone="success">Approved</Badge>) },
            { key: "date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => !isReversed(row) && <ReverseButton row={row} path={`capital/floats/${row.id}/reverse`} description={`float ${row.from_account ?? ""} → ${row.to_account ?? "HQ"}`} />,
            },
          ]}
          footer={<tr><td>TOTAL:</td><td /><td /><td><b>{money(totalAmount(transfers))}</b> <small className="text-muted">(excl. reversed)</small></td><td /><td /><td /></tr>}
        />
      </Card>
      <DateFilterModal open={open} title="Filter By" onClose={() => setOpen(false)} onApply={setFilters} />
    </>
  );
}
