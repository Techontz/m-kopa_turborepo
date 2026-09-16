"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { DateFilterModal, totalAmount, type DateFilters, type FloatTransfer } from "@/components/capital/DateFilterModal";
import { ApprovalActions, ApprovalStatus, isPending } from "@/components/finance/Approval";
import { ReverseButton } from "@/components/finance/Reversal";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface FloatSource {
  value: string;
  bank_account_id: number | null;
  label: string;
  balance: number;
}

interface FloatList {
  data: FloatTransfer[];
  total: number;
  sources: FloatSource[];
}

const EMPTY = { amount: "", from_account: "", bank_account_id: "" };

/** The key of a source option: the account, plus the bank account id when the money leaves a bank. */
const sourceKey = (source: FloatSource) => `${source.value}:${source.bank_account_id ?? ""}`;

/**
 * Transfer Float Form — company money → the HQ PRINCIPAL A/C. The money is taken from the account chosen here (Company A/C,
 * a bank account or the Investment RESERVE A/C); assets are never a source and a branch is never a destination: HQ/Finance
 * funds and disburses loans. Rule 6: the float is requested as PENDING and posted when another authorised user approves it.
 */
export default function CompanyFloatPage() {
  const [filters, setFilters] = useState<DateFilters | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const { data, isLoading } = useQuery({ queryKey: ["capital/floats", filters], queryFn: () => api.get<FloatList>("capital/floats", filters ? { ...filters } : undefined) });
  const create = useAction<typeof EMPTY>("post", "capital/floats");
  const transfers = data?.data;
  const sources = data?.sources ?? [];
  const selected = sources.find((source) => sourceKey(source) === `${form.from_account}:${form.bank_account_id}`);

  return (
    <>
      <PageHeader crumbs={["Transfer Float From Company Account To HQ"]} />

      <Card title="Transfer Float Form">
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(form, { onSuccess: () => setForm(EMPTY) }); }}>
          <div className="row">
            <Field label="Amount:" required className="col-md-6" error={create.fieldError("amount")}>
              <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
              <small className="text-muted">TO: HQ PRINCIPAL A/C</small>
            </Field>
            <Field label="Deduct From:" required className="col-md-6" error={create.fieldError("from_account") ?? create.fieldError("bank_account_id")}>
              <select
                className="form-control"
                value={selected ? sourceKey(selected) : ""}
                onChange={(e) => {
                  const source = sources.find((option) => sourceKey(option) === e.target.value);
                  setForm({ ...form, from_account: source?.value ?? "", bank_account_id: source?.bank_account_id ? String(source.bank_account_id) : "" });
                }}
                required
              >
                <option value="">---Select Account---</option>
                {sources.map((source) => (
                  <option key={sourceKey(source)} value={sourceKey(source)}>{source.label} — {money(source.balance)}</option>
                ))}
              </select>
              {selected && <small className="text-muted">AVAILABLE: {money(selected.balance)}</small>}
            </Field>
          </div>
          <div className="text-center m-t-20">
            <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-pencil" />Request Transfer</button>
          </div>
        </form>
      </Card>

      <Card title={filters ? `Transaction ${filters.from} - ${filters.to}` : "Today Transaction"} actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setFilterOpen(true)}><i className="icon-calendar" />Previous</button>}>
        <DataTable
          rows={transfers}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "from_account", header: "From Account" },
            { key: "to_account", header: "To Account" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "date", header: "Date" },
            { key: "status", header: "Status", render: (row) => <ApprovalStatus row={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                isPending(row) ? (
                  <ApprovalActions row={row} approvePath={`capital/floats/${row.id}/approve`} rejectPath={`capital/floats/${row.id}/reject`} description={`float ${row.from_account ?? ""} → ${row.to_account ?? "HQ"}`} />
                ) : (
                  row.status === "approved" && <ReverseButton row={row} path={`capital/floats/${row.id}/reverse`} description={`float ${row.from_account ?? ""} → ${row.to_account ?? "HQ"}`} />
                ),
            },
          ]}
          footer={<tr><td><b>TOTAL</b> <small className="text-muted">(posted only)</small></td><td><b>{money(totalAmount(transfers))}</b></td><td colSpan={4} /></tr>}
        />
      </Card>

      <DateFilterModal open={filterOpen} title="Filter Transaction by" onClose={() => setFilterOpen(false)} onApply={setFilters} />
    </>
  );
}
