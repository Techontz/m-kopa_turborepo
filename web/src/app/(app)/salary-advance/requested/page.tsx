"use client";

import { useState } from "react";

import { sum } from "@/components/finance-b/FilterModal";
import type { SalaryAdvance, SalaryAdvanceCategory } from "@/components/finance-b/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { confirmAction } from "@/components/ui/notify";
import { money, percent } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface RequestForm {
  blanch_id: string;
  customer_id: string;
  per_id: string;
  loan_amount: string;
}

const EMPTY: RequestForm = { blanch_id: "", customer_id: "", per_id: "", loan_amount: "" };

export default function SalaryAdvanceRequestedPage() {
  const { data: advances, isLoading } = useApi<SalaryAdvance[]>("salary-advance/requested");
  const { data: categories } = useApi<SalaryAdvanceCategory[]>("salary-advance/categories");
  const [form, setForm] = useState<RequestForm>(EMPTY);

  const create = useAction<RequestForm>("post", "salary-advance/advances");
  const approve = useAction<{ id: number }>("post", (body) => `salary-advance/advances/${body.id}/approve`);
  const remove = useAction<{ id: number }>("delete", (body) => `salary-advance/advances/${body.id}`);

  return (
    <>
      <PageHeader crumbs={["Salary Advance", "salary Advance Loan Requested"]} />

      <Card title="Request Loan">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await confirmAction()) {
              create.mutate(form, { onSuccess: () => setForm(EMPTY) });
            }
          }}
        >
          <div className="row">
            <Field label="Branch:" required className="col-md-6 col-6" error={create.fieldError("blanch_id")}>
              <SelectBox placeholder="Select Branch" optionsUrl="options/branches" value={form.blanch_id} onChange={(value) => setForm({ ...form, blanch_id: value ?? "", customer_id: "" })} />
            </Field>
            <Field label="Customer:" required className="col-md-6 col-6" error={create.fieldError("customer_id")}>
              <SelectBox
                placeholder="Select customer"
                optionsUrl={form.blanch_id ? "options/customers" : undefined}
                options={form.blanch_id ? undefined : []}
                query={{ branch_id: form.blanch_id }}
                value={form.customer_id}
                onChange={(value) => setForm({ ...form, customer_id: value ?? "" })}
              />
            </Field>
            <Field label="Select Category:" required className="col-md-6 col-6" error={create.fieldError("per_id")}>
              <select className="form-control" value={form.per_id} onChange={(e) => setForm({ ...form, per_id: e.target.value })} required>
                <option value="">Select Category</option>
                {(categories ?? []).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Loan Amount" required className="col-md-6 col-6" error={create.fieldError("loan_amount")}>
              <input type="number" className="form-control" placeholder="Enter Amount" autoComplete="off" value={form.loan_amount} onChange={(e) => setForm({ ...form, loan_amount: e.target.value })} />
            </Field>
          </div>
          <div className="text-center m-t-10">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Request</button>
          </div>
        </form>
      </Card>

      <Card title="Salary Advance Requested">
        <DataTable
          rows={advances}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "customer", header: "Customer Name" },
            { key: "branch", header: "Branch Name" },
            { key: "amount", header: "Loan Amount", render: (row) => money(row.amount) },
            { key: "interest_rate", header: "Interest", render: (row) => percent(row.interest_rate) },
            { key: "total_payable", header: "Principal + Interest", render: (row) => money(row.total_payable) },
            { key: "paid_amount", header: "Paid Amount", render: (row) => money(row.paid_amount) },
            { key: "remaining_amount", header: "Remain Amount", render: (row) => money(row.remaining_amount) },
            { key: "status", header: "Status", render: () => "Pending" },
            { key: "created_at", header: "Date" },
            {
              key: "action",
              header: "Action",
              sortable: false,
              className: "text-nowrap",
              render: (row) => (
                <>
                  <button type="button" className="btn btn-success btn-sm mr-1" title="Approve" disabled={approve.isPending} onClick={async () => (await confirmAction("Are you sure to Approve?")) && approve.mutate({ id: row.id })}><i className={approve.isPending && approve.variables?.id === row.id ? "fa fa-spinner fa-spin" : "icon-like"} /></button>
                  <button type="button" className="btn btn-danger btn-sm" title="Delete" onClick={async () => (await confirmAction()) && remove.mutate({ id: row.id })}><i className="icon-trash" /></button>
                </>
              ),
            },
          ]}
          footer={
            <tr>
              <td><b>TOTAL:</b></td>
              <td />
              <td><b>{money(sum(advances, (row) => row.amount))}</b></td>
              <td />
              <td><b>{money(sum(advances, (row) => row.total_payable))}</b></td>
              <td><b>{money(sum(advances, (row) => row.paid_amount))}</b></td>
              <td><b>{money(sum(advances, (row) => row.remaining_amount))}</b></td>
              <td />
              <td />
              <td />
            </tr>
          }
        />
      </Card>
    </>
  );
}
