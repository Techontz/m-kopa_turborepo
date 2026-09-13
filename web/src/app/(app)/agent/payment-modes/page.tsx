"use client";

import { useState } from "react";

import { HeaderButton } from "@/components/finance-b/FilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmAction } from "@/components/ui/notify";
import { useAction, useApi } from "@/lib/hooks";

interface PaymentMode {
  id: number;
  name: string;
}

export default function PaymentModesPage() {
  const { data: modes, isLoading } = useApi<PaymentMode[]>("agent/payment-modes");
  const [creating, setCreating] = useState(false);
  const [payMode, setPayMode] = useState("");

  const create = useAction<{ pay_mode: string }>("post", "agent/payment-modes");
  const remove = useAction<{ id: number }>("delete", (body) => `agent/payment-modes/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Clientless transaction", "mode of payment"]} />

      <Card title="Mode of Payment List" actions={<HeaderButton icon="icon-pencil" onClick={() => setCreating(true)} />}>
        <DataTable
          rows={modes}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, value: (row) => row.id },
            { key: "name", header: "Mode of payment" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) => (
                <button type="button" className="btn btn-sm btn-danger" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Register Mode of Payment"
        submitLabel="save"
        submitting={create.isPending}
        onSubmit={() => create.mutate({ pay_mode: payMode }, { onSuccess: () => { setPayMode(""); setCreating(false); } })}
      >
        <div className="row clearfix">
          <Field label="Mode of payment" className="col-md-12" error={create.fieldError("pay_mode")}>
            <input type="text" className="form-control" placeholder="Enter Amount" autoComplete="off" value={payMode} onChange={(e) => setPayMode(e.target.value)} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
