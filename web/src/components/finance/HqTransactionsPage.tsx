"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { FilterModal, HeaderButton, sum, type Filters } from "./FilterModal";
import { ApprovalActions, ApprovalStatus } from "./Approval";
import { isReversed, ReverseButton } from "./Reversal";
import type { HqTransaction } from "./types";

interface TransactionForm {
  from_account: string;
  to_account: string;
  amount: string;
  charge: string;
}

const EMPTY: TransactionForm = { from_account: "", to_account: "", amount: "", charge: "" };

/** Headquarters Transaction → Requested Transaction (live request_headqueter) / Approved Transaction (request_headqueter_aproved). */
export function HqTransactionsPage({ approved }: { approved: boolean }) {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "request" | null>(null);
  const [form, setForm] = useState<TransactionForm>(EMPTY);
  const { data: rows, isLoading } = useApi<HqTransaction[]>("hq/transactions", { status: approved ? "approved" : "pending", from: filters.from, to: filters.to });
  const create = useAction<TransactionForm>("post", "hq/transactions");
  const remove = useAction<{ id: number }>("delete", (body) => `hq/transactions/${body.id}`);

  const columns: Column<HqTransaction>[] = [
    { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
    { key: "from_account_label", header: "From Account" },
    { key: "amount", header: "Amount", render: (row) => money(row.amount) },
    { key: "to_account_label", header: "To Account" },
    { key: "status", header: "status", render: (row) => <ApprovalStatus row={row} /> },
    { key: "staff", header: "Staff Name" },
    { key: "charge", header: "Charger", render: (row) => money(row.charge) },
    approved
      ? { key: "approved_at", header: "Approved Date" }
      : { key: "date", header: "Date" },
  ];

  if (approved) {
    columns.push({
      key: "action",
      header: "Action",
      sortable: false,
      render: (row) => row.status === "approved" && <ReverseButton row={row} path={`hq/transactions/${row.id}/reverse`} description={`${row.from_account_label ?? ""} → ${row.to_account_label ?? ""} (charge ${money(row.charge)} reversed too)`} />,
    });
  } else {
    columns.push({
      key: "action",
      header: "Action",
      sortable: false,
      className: "text-nowrap",
      render: (row) => (
        <>
          <ApprovalActions row={row} approvePath={`hq/transactions/${row.id}/approve`} description={`${row.from_account_label ?? ""} → ${row.to_account_label ?? ""} (charge ${money(row.charge)})`} />
          <button type="button" className="btn btn-sm btn-icon btn-danger ml-1" title="Delete request" disabled={remove.isPending} onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
        </>
      ),
    });
  }

  return (
    <>
      <PageHeader crumbs={[approved ? "Headquarters Transaction Approved" : "Headquarters Transaction requested"]} />
      <Card
        title={approved ? "From Headquarters Approved Transaction - CEO ACC" : "From Headquarters Transaction - CEO ACC"}
        actions={approved ? <HeaderButton onClick={() => setModal("filter")} /> : <HeaderButton icon="icon-pencil" onClick={() => { setForm(EMPTY); setModal("request"); }} />}
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={columns}
          footer={
            <tr>
              <td><b>TOTAL:</b>{approved && <small className="text-muted d-block">(excl. reversed)</small>}</td>
              <td />
              <td><b>{money(sum(rows, (row) => (isReversed(row) ? 0 : row.amount)))}</b></td>
              <td />
              <td />
              <td />
              <td><b>{money(sum(rows, (row) => (isReversed(row) ? 0 : row.charge)))}</b></td>
              <td colSpan={2} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />

      <Modal open={modal === "request"} onClose={() => setModal(null)} title="Request Transaction" submitLabel="Request" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="From Account:" required className="col-lg-6" error={create.fieldError("from_account")}>
            <SelectBox placeholder="Select Account" optionsUrl="hq/options/accounts" query={{ direction: "from" }} value={form.from_account} onChange={(value) => setForm({ ...form, from_account: value ?? "" })} />
          </Field>
          <Field label="To Account:" required className="col-lg-6" error={create.fieldError("to_account")}>
            <SelectBox placeholder="Select Account" optionsUrl="hq/options/accounts" value={form.to_account} onChange={(value) => setForm({ ...form, to_account: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Charger:" className="col-lg-6" error={create.fieldError("charge")}>
            <input type="number" className="form-control" placeholder="Chargers Fee" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
