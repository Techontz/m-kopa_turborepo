"use client";

import { useState } from "react";

import { PaymentFilterModal, SearchButton, type PaymentFilters } from "@/components/payments/PaymentFilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface PenaltyRow {
  id: number;
  customer: string | null;
  branch: string | null;
  loan_amount: number;
  amount: number;
  paid_amount: number;
  remaining: number;
  penalty_date: string;
}

/** Penarty → Penarty List (live admin/get_penart_list). */
export default function PenaltyListPage() {
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [filtering, setFiltering] = useState(false);
  const [paying, setPaying] = useState<PenaltyRow | null>(null);
  const [amount, setAmount] = useState("");
  const { data: rows, isLoading } = useApi<PenaltyRow[]>("penalties", { branch_id: filters.branch_id });

  const pay = useAction<{ id: number; penart_paid: string }>("post", (body) => `penalties/${body.id}/pay`);
  const waive = useAction<{ id: number }>("post", (body) => `penalties/${body.id}/waive`);

  return (
    <>
      <PageHeader crumbs={["Penarty", "Penarty List"]} />

      <Card title="Penarty List" actions={<SearchButton onClick={() => setFiltering(true)} />}>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "loan_amount", header: "Loan Amount", render: (row) => money(row.loan_amount) },
            { key: "remaining", header: "Penart Amount", render: (row) => money(row.remaining) },
            { key: "penalty_date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" onClick={() => { setPaying(row); setAmount(""); }}><i className="icon-pencil" /></button>
                  <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && waive.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={paying !== null}
        onClose={() => setPaying(null)}
        title={paying && `${paying.customer} — ${money(paying.remaining)}`}
        submitLabel="Pay"
        submitting={pay.isPending}
        onSubmit={() => paying && pay.mutate({ id: paying.id, penart_paid: amount }, { onSuccess: () => setPaying(null) })}
      >
        <div className="row">
          <div className="col-md-12">
            <span>*Amount:</span>
            <input type="number" className="form-control" placeholder="Enter Amount" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            {pay.fieldError("penart_paid") && <div className="field-error">{pay.fieldError("penart_paid")}</div>}
          </div>
        </div>
      </Modal>

      <PaymentFilterModal open={filtering} onClose={() => setFiltering(false)} onApply={setFilters} withDates={false} />
    </>
  );
}
