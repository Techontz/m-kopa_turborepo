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
  from_acc: string;
  amount: string;
  to_acc: string;
  charger_fee: string;
}

const EMPTY: TransferForm = { from_acc: "", amount: "", to_acc: "", charger_fee: "" };

export default function BankToHqPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const { data: rows, isLoading } = useApi<BankTransfer[]>("bank/to-hq", { from: filters.from, to: filters.to });
  const create = useAction<TransferForm>("post", "bank/to-hq");

  return (
    <>
      <PageHeader crumbs={["Bank", "Transfer Balance To salary advance Acc"]} />
      <Card
        title="Transaction list From Bank Acc to salary Advance & disbursement Account"
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
            { key: "hq_account_label", header: "To Account" },
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

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Transfer Balance To salary advance Acc" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="From Account:" className="col-lg-6" error={create.fieldError("from_acc")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/accounts" value={form.from_acc} onChange={(value) => setForm({ ...form, from_acc: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="To Account:" required className="col-lg-6" error={create.fieldError("to_acc")}>
            <select className="form-control" value={form.to_acc} onChange={(e) => setForm({ ...form, to_acc: e.target.value })} required>
              <option value="">Select</option>
              <option value="salary">SALARY ACC</option>
              <option value="disbursement">DISBURSEMENT ACC</option>
            </select>
          </Field>
          <Field label="Chargers Fee:" required className="col-lg-6" error={create.fieldError("charger_fee")}>
            <input type="number" className="form-control" placeholder="Chargers Fee" value={form.charger_fee} onChange={(e) => setForm({ ...form, charger_fee: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
