"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

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
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

interface PettyCashForm {
  branch_id: string;
  amount: string;
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

const EMPTY: PettyCashForm = { branch_id: "", amount: "" };
const DESCRIPTION = "petty cash to the branch";

type Tab = "transfers" | "balances";
const TABS: Array<[Tab, string]> = [["transfers", "Transfers"], ["balances", "Branch Balances"]];

/**
 * Bank → Send Petty Cash To Branch. Petty cash is the only money a branch holds: HQ sends it out of interest income, and the
 * branch spends it only on expenses HQ accepts. Rule 6: requested as PENDING, posted when another authorised user approves.
 */
export default function BranchPettyCashPage() {
  const { can } = useAuth();
  // Sending is Finance's leg; an owner reaching this page from Pending Approvals only reads it and decides.
  const maySend = can("funds.transfer");
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<PettyCashForm>(EMPTY);
  const { data, isLoading } = useQuery({ queryKey: ["bank/petty-cash", filters], queryFn: () => api.get<PettyCashList>("bank/petty-cash", { branch_id: "all", ...filters }) });
  const create = useAction<PettyCashForm>("post", "bank/petty-cash");
  const rows = data?.data;
  const branches = data?.branches ?? [];
  const [tab, setTab] = useState<Tab>("transfers");

  const open = (branchId = "") => {
    setForm({ ...EMPTY, branch_id: branchId });
    create.setErrors({});
    setModal("transfer");
  };

  const totalHeld = sum(branches, (branch) => branch.petty_cash);
  const pending = (rows ?? []).filter(isPending);
  const funded = branches.filter((branch) => branch.petty_cash > 0).length;
  const lastSent = (branchId: number) =>
    (rows ?? []).filter((row) => row.branch_id === branchId && row.status === "approved").map((row) => row.transfer_date).sort().at(-1);

  const tiles: Array<[string, string, ReactNode, string?]> = [
    ["bg-success", "HQ Interest Available", money(data?.hq_interest_balance)],
    ["bg-info", "Petty Cash Held By Branches", money(totalHeld)],
    ["bg-warning", "Awaiting Approval", money(sum(pending, (row) => row.amount)), `${pending.length} request${pending.length === 1 ? "" : "s"}`],
    ["bg-primary", "Branches Holding Petty Cash", `${funded} / ${branches.length}`],
  ];

  return (
    <>
      <PageHeader crumbs={["Bank", "Send Petty Cash To Branch"]} />
      <Card>
        <div className="row clearfix">
          {tiles.map(([color, label, value, note]) => (
            <div className="col-lg-3 col-md-6" key={label}>
              <div className={`body dashboard-stat ${color} text-light`}>
                <h5 className="mb-0"><i className="icon-wallet" /> {value}</h5>
                <span>{label}</span>
                {note && <small className="d-block">{note}</small>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Branch petty cash"
        actions={
          <>
            {maySend && <span className="mr-1"><HeaderButton icon="icon-pencil" title="Send petty cash" onClick={() => open()} /></span>}
            {tab === "transfers" && <HeaderButton onClick={() => setModal("filter")} />}
          </>
        }
      >
        <ul className="nav nav-tabs-new mb-3">
          {TABS.map(([key, label]) => (
            <li className="nav-item" key={key}>
              <button type="button" className={`nav-link ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
            </li>
          ))}
        </ul>
        {tab === "transfers" ? (
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
        ) : (
          <DataTable
            rows={branches}
            loading={isLoading}
            rowKey={(branch) => branch.id}
            columns={[
              { key: "sn", header: "S/no.", render: (_, index) => `${index + 1}.`, sortable: false },
              { key: "name", header: "Branch" },
              { key: "petty_cash", header: "Petty Cash Held", render: (branch) => <b>{money(branch.petty_cash)}</b> },
              { key: "last_sent", header: "Last Sent", value: (branch) => lastSent(branch.id) ?? "", render: (branch) => lastSent(branch.id) ?? "—" },
              {
                key: "action",
                header: "Action",
                sortable: false,
                render: (branch) =>
                  maySend ? (
                    <button type="button" className="btn btn-sm btn-info" onClick={() => open(String(branch.id))}><i className="icon-paper-plane" /> Send</button>
                  ) : (
                    "—"
                  ),
              },
            ]}
            footer={
              <tr>
                <td colSpan={2}>TOTAL:</td>
                <td><b>{money(totalHeld)}</b></td>
                <td colSpan={2} />
              </tr>
            }
          />
        )}
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
