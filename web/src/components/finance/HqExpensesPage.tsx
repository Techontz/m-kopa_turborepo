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
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

import { AcceptExpenseModal } from "./AcceptExpenseModal";
import { FilterModal, HeaderButton, sum, type Filters } from "./FilterModal";
import type { ExpenseRequest } from "./types";

interface RequestForm {
  scope: "hq";
  blanch_id: string;
  ex_id: string;
  req_amount: string;
  req_description: string;
}

const EMPTY: RequestForm = { scope: "hq", blanch_id: "", ex_id: "", req_amount: "", req_description: "" };

/** Headquater Expenses → All Expenses Requested (live get_hq_expenses_request) / All Aproved Expenses (get_hq_expenses_aproved). */
export function HqExpensesPage({ approved }: { approved: boolean }) {
  const { can } = useAuth();
  const heading = approved ? "Headquater Aproved Expenses" : "Headquater Recomended Expenses";
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "request" | null>(null);
  const [form, setForm] = useState<RequestForm>(EMPTY);
  const [accepting, setAccepting] = useState<ExpenseRequest | null>(null);
  const { data: rows, isLoading } = useApi<ExpenseRequest[]>("expenses/requests", { scope: "hq", status: approved ? "accepted" : "pending", ...filters });
  const create = useAction<RequestForm>("post", "expenses/requests");
  const remove = useAction<{ id: number }>("delete", (body) => `expenses/requests/${body.id}`);

  return (
    <>
      <PageHeader crumbs={[heading]} />
      <Card
        title={heading}
        actions={approved ? <HeaderButton onClick={() => setModal("filter")} /> : can("hq.manage") && <HeaderButton icon="icon-pencil" onClick={() => { setForm(EMPTY); setModal("request"); }} />}
      >
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/No.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "expense", header: "Expenses", render: (row) => <>{row.expense}{row.branch && <small className="d-block text-muted">{row.branch}</small>}</> },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "description", header: "Description" },
            { key: "staff", header: "Staff" },
            { key: "status", header: "status", render: (row) => (row.status === "accepted" ? <Badge tone="success">APROVED</Badge> : <Badge tone="danger">NOT APROVED</Badge>) },
            { key: "request_date", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) =>
                row.status === "pending" && row.can_approve ? (
                  <>
                    <button type="button" className="btn btn-sm btn-icon btn-primary mr-1" title="Accept" onClick={() => setAccepting(row)}><i className="icon-pencil" /></button>
                    <button type="button" className="btn btn-sm btn-icon btn-danger" title="Reject" onClick={async () => (await confirmAction("Are You Sure?")) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                  </>
                ) : (
                  row.paid_from && <small>{row.paid_from}</small>
                ),
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td colSpan={5} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />
      <AcceptExpenseModal request={accepting} onClose={() => setAccepting(null)} />

      <Modal open={modal === "request"} onClose={() => setModal(null)} title="Request Expenses" submitLabel="Request" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="Select Branch:" className="col-lg-12" error={create.fieldError("blanch_id")}>
            <SelectBox placeholder="Select Branch" optionsUrl="options/branches" value={form.blanch_id} isClearable onChange={(value) => setForm({ ...form, blanch_id: value ?? "" })} />
          </Field>
          <Field label="Select Expenses:" className="col-lg-6" error={create.fieldError("ex_id")}>
            <SelectBox placeholder="Select Expenses" optionsUrl="expenses/options/types" query={{ scope: "hq" }} value={form.ex_id} onChange={(value) => setForm({ ...form, ex_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" className="col-lg-6" error={create.fieldError("req_amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.req_amount} onChange={(e) => setForm({ ...form, req_amount: e.target.value })} required />
          </Field>
          <Field label="Description:" className="col-lg-12" error={create.fieldError("req_description")}>
            <textarea className="form-control" rows={4} placeholder="Description" value={form.req_description} onChange={(e) => setForm({ ...form, req_description: e.target.value })} required />
          </Field>
        </div>
      </Modal>
    </>
  );
}
