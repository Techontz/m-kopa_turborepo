"use client";

import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance/FilterModal";
import type { BankTransfer } from "@/components/finance/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface TransferForm {
  from_account: string;
  to_blanch: string;
  amount: string;
  charger_fee: string;
}

const EMPTY: TransferForm = { from_account: "", to_blanch: "", amount: "", charger_fee: "" };

export default function BankToBranchPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const { data: rows, isLoading } = useApi<BankTransfer[]>("bank/to-branch", { ...filters });
  const create = useAction<TransferForm>("post", "bank/to-branch");

  return (
    <>
      <PageHeader crumbs={["Bank", "Transfor Balance"]} />
      <Card
        title="Transaction list"
        actions={
          <>
            <span className="mr-1"><HeaderButton icon="icon-pencil" onClick={() => { setForm(EMPTY); setModal("transfer"); }} /></span>
            <HeaderButton onClick={() => setModal("filter")} />
          </>
        }
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "charge", header: "Chargers Fee", render: (row) => money(row.charge) },
            { key: "bank_account", header: "From Account" },
            { key: "branch", header: "To Brach" },
            { key: "transfer_date", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: () => null },
          ]}
          footer={
            <tr>
              <td>TOTAL:</td>
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td><b>{money(sum(rows, (row) => row.charge))}</b></td>
              <td colSpan={4} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} withBranch />

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Transfor Balance" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="From Account:" className="col-lg-6" error={create.fieldError("from_account")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/accounts" value={form.from_account} onChange={(value) => setForm({ ...form, from_account: value ?? "" })} />
          </Field>
          <Field label="To Branch:" className="col-lg-6" error={create.fieldError("to_blanch")}>
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" value={form.to_blanch} onChange={(value) => setForm({ ...form, to_blanch: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Chargers Fee:" required className="col-lg-6" error={create.fieldError("charger_fee")}>
            <input type="number" className="form-control" placeholder="Chargers Fee" value={form.charger_fee} onChange={(e) => setForm({ ...form, charger_fee: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
