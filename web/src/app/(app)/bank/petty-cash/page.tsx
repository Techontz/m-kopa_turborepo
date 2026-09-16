"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance/FilterModal";
import { ApprovalActions, ApprovalStatus, isPending } from "@/components/finance/Approval";
import { ReverseButton } from "@/components/finance/Reversal";
import type { BankTransfer } from "@/components/finance/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface PettyCashForm {
  branch_id: string;
  amount: string;
  reference: string;
}

interface BranchPettyCash {
  id: number;
  name: string;
  petty_cash: number;
}

interface PettyCashList {
  data: BankTransfer[];
  hq_interest_balance: number;
  branches: BranchPettyCash[];
}

const EMPTY: PettyCashForm = { branch_id: "", amount: "", reference: "" };
const DESCRIPTION = "petty cash to the branch";

/**
 * Bank → Send Petty Cash To Branch. Petty cash is the only money a branch holds: HQ sends it out of interest income, and the
 * branch spends it only on expenses HQ accepts. Rule 6: requested as PENDING, posted when another authorised user approves.
 */
export default function BranchPettyCashPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<PettyCashForm>(EMPTY);
  const { data, isLoading } = useQuery({ queryKey: ["bank/petty-cash", filters], queryFn: () => api.get<PettyCashList>("bank/petty-cash", { branch_id: "all", ...filters }) });
  const create = useAction<PettyCashForm>("post", "bank/petty-cash");
  const rows = data?.data;
  const branches = data?.branches ?? [];

  const open = () => {
    setForm(EMPTY);
    create.setErrors({});
    setModal("transfer");
  };

  return (
    <>
      <PageHeader crumbs={["Bank", "Send Petty Cash To Branch"]} />
      <Card
        title={<>Petty cash sent to branches <small className="ml-2">HQ interest income available: <b>{money(data?.hq_interest_balance)}</b></small></>}
        actions={
          <>
            <span className="mr-1"><HeaderButton icon="icon-pencil" title="Send petty cash" onClick={open} /></span>
            <HeaderButton onClick={() => setModal("filter")} />
          </>
        }
      >
        <div className="row clearfix mb-3">
          {branches.map((branch) => (
            <div className="col-md-3" key={branch.id}>
              <div className="body dashboard-stat bg-info text-light">
                <h6 className="mb-0"><i className="icon-wallet" /> {money(branch.petty_cash)}</h6>
                <small className="d-block">{branch.name}</small>
              </div>
            </div>
          ))}
        </div>
        <DataTable
          rows={rows}
          loading={isLoading}
          rowKey={(row) => row.id}
          columns={[
            { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
            { key: "branch", header: "Branch" },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "reference", header: "Reference", render: (row) => row.reference || "-" },
            { key: "journal_reference", header: "Journal Ref", render: (row) => row.journal_reference ?? "—" },
            { key: "employee", header: "Requested By", render: (row) => row.employee ?? "—" },
            { key: "transfer_date", header: "Date" },
            { key: "status", header: "Status", render: (row) => <ApprovalStatus row={row} /> },
            {
              key: "action",
              header: "Action",
              sortable: false,
              render: (row) =>
                isPending(row) ? (
                  <ApprovalActions row={row} approvePath={`bank/transfers/${row.id}/approve`} rejectPath={`bank/transfers/${row.id}/reject`} description={`${DESCRIPTION} ${row.branch ?? ""}`} />
                ) : (
                  row.status === "approved" && <ReverseButton row={row} path={`bank/transfers/${row.id}/reverse`} description={`${DESCRIPTION} ${row.branch ?? ""}`} />
                ),
            },
          ]}
          footer={
            <tr>
              <td colSpan={2}>TOTAL <small className="text-muted">(posted only)</small>:</td>
              <td><b>{money(sum(rows, (row) => (row.status === "approved" ? row.amount : 0)))}</b></td>
              <td colSpan={6} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Send Petty Cash To Branch" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="Branch:" required className="col-lg-6" error={create.fieldError("branch_id")}>
            <select className="form-control" value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })} required>
              <option value="">---Select Branch---</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name} — holds {money(branch.petty_cash)}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Reference:" className="col-lg-6" error={create.fieldError("reference")}>
            <input className="form-control" placeholder="Reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={100} />
          </Field>
          <div className="col-12">
            <small className="text-muted">
              Paid out of interest income (available: {money(data?.hq_interest_balance)}) once another authorised user approves. The branch then spends it only on expenses HQ accepts.
            </small>
          </div>
        </div>
      </Modal>
    </>
  );
}
