"use client";

import { useState } from "react";

import { DateFilterModal, totalAmount, type DateFilters, type FloatTransfer } from "@/components/capital/DateFilterModal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

const EMPTY = { blanch_amount: "", blanch_id: "" };

/** Live admin/transfar_amount — company account → branch principal account. */
export default function CompanyFloatPage() {
  const [filters, setFilters] = useState<DateFilters | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data: transfers, isLoading } = useApi<FloatTransfer[]>("capital/floats", filters ? { ...filters } : undefined);
  const { data: balances } = useApi<{ company: number }>("capital/floats/balances");
  const create = useAction<typeof EMPTY>("post", "capital/floats");

  return (
    <>
      <PageHeader crumbs={["Transfer Float From Company Account To Branch Account"]} />

      <Card title="Transfer Float Form">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <div className="row">
            <Field label="Amount:" required className="col-md-6" error={create.fieldError("blanch_amount")}>
              <input type="number" className="form-control" placeholder="Amount" value={form.blanch_amount} onChange={(e) => setForm({ ...form, blanch_amount: e.target.value })} required />
              {balances && <small className="text-muted">COMPANY ACCOUNT: {money(balances.company)}</small>}
            </Field>
            <Field label="To Branch Name:" required className="col-md-6" error={create.fieldError("blanch_id")}>
              <SelectBox placeholder="---Select Branch---" optionsUrl="options/branches" value={form.blanch_id} onChange={(value) => setForm({ ...form, blanch_id: value ?? "" })} />
            </Field>
          </div>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-pencil" />Transfer</button>
          </div>
        </form>
      </Card>

      <Card title={filters ? `Transaction ${filters.from} - ${filters.to}` : "Today Transaction"} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setFilterOpen(true)}><i className="icon-calendar" />Previous</button>}>
        <DataTable
          rows={transfers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "to_branch", header: "Branch" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "date", header: "Date" },
            { key: "action", header: "Action", sortable: false, render: () => null },
          ]}
          footer={<tr><td><b>TOTAL</b></td><td><b>{money(totalAmount(transfers))}</b></td><td /><td /></tr>}
        />
      </Card>

      <DateFilterModal open={filterOpen} title="Filter Transaction by" withBranch onClose={() => setFilterOpen(false)} onApply={setFilters} />
    </>
  );
}
