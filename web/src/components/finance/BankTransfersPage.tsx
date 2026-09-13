"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { FilterModal, HeaderButton, sum, type Filters } from "./FilterModal";
import type { BankTransfer } from "./types";

interface TransferForm {
  from_blanch_id: string;
  ac_type: string;
  amount: string;
  to_account_id: string;
}

const EMPTY: TransferForm = { from_blanch_id: "", ac_type: "", amount: "", to_account_id: "" };

/** Bank → Bank Transaction (pending, live bank_transaction_list) and Approved Transaction (get_aproved_transaction). */
export function BankTransfersPage({ approved }: { approved: boolean }) {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const { data: rows, isLoading } = useApi<BankTransfer[]>("bank/transfers", { status: approved ? "approved" : "pending", ...filters });
  const create = useAction<TransferForm>("post", "bank/transfers");
  const approve = useAction<{ id: number }>("post", (body) => `bank/transfers/${body.id}/approve`);
  const remove = useAction<{ id: number }>("delete", (body) => `bank/transfers/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Bank", "Bank Transaction list"]} />
      <Card
        title={approved ? "Transaction Approved list" : "Transaction list"}
        actions={approved ? <HeaderButton onClick={() => setModal("filter")} /> : <HeaderButton icon="icon-pencil" onClick={() => { setForm(EMPTY); setModal("transfer"); }} />}
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "From Branch" },
            { key: "branch_account_label", header: "From A/c" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "bank_account", header: "To A/C" },
            { key: "status", header: "status", render: (row) => (row.status === "approved" ? <Badge tone="success">APPROVED</Badge> : <Badge tone="danger">PENDING</Badge>) },
            { key: "transfer_date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                row.status === "pending" && (
                  <>
                    <button type="button" className="btn btn-sm btn-icon btn-success mr-1" title="Approve" onClick={async () => (await confirmAction()) && approve.mutate({ id: row.id })}><i className="icon-like" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ),
            },
          ]}
          footer={
            <tr>
              <td>TOTAL:</td>
              <td />
              <td />
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td colSpan={4} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} withBranch />

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Transfer Amount From Branch To Bank" submitLabel="Transfer" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="From Branch" required className="col-lg-6" error={create.fieldError("from_blanch_id")}>
            <SelectBox placeholder="Select branch" optionsUrl="options/branches" value={form.from_blanch_id} onChange={(value) => setForm({ ...form, from_blanch_id: value ?? "" })} />
          </Field>
          <Field label="Branch Account" required className="col-lg-6" error={create.fieldError("ac_type")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/branch-accounts" value={form.ac_type} onChange={(value) => setForm({ ...form, ac_type: value ?? "" })} />
          </Field>
          <Field label="Amount" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Enter Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Bank Account Name" required className="col-lg-6" error={create.fieldError("to_account_id")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/accounts" value={form.to_account_id} onChange={(value) => setForm({ ...form, to_account_id: value ?? "" })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
