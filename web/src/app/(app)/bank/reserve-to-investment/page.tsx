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

interface TransferForm {
  amount: string;
}

interface TransferList {
  data: BankTransfer[];
  hq_reserve_balance: number;
  investment_reserve_balance: number;
}

const EMPTY: TransferForm = { amount: "" };
const DESCRIPTION = "HQ reserve → Investment RESERVE A/C";

/**
 * Bank → Send Reserve To Investment. All interest reserve belongs to HQ (each branch RESERVE A/C is only a report of what the
 * branch generated). HQ sends an amount of it to the Investment RESERVE A/C shown on the Super Admin dashboard; it leaves the
 * HQ reserve and is added to the Investment only when Super Admin, Admin or a Shareholder (not the requester) approves.
 */
export default function ReserveToInvestmentPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const { data, isLoading } = useQuery({ queryKey: ["bank/reserve-to-investment", filters], queryFn: () => api.get<TransferList>("bank/reserve-to-investment", { ...filters }) });
  const create = useAction<TransferForm>("post", "bank/reserve-to-investment");
  const rows = data?.data;

  const open = () => {
    setForm(EMPTY);
    create.setErrors({});
    setModal("transfer");
  };

  return (
    <>
      <PageHeader crumbs={["Bank", "Send Reserve To Investment"]} />
      <Card
        title={
          <>
            Reserve sent to Investment
            <small className="ml-2">HQ reserve (all branches): <b>{money(data?.hq_reserve_balance)}</b></small>
            <small className="ml-2">Investment RESERVE A/C: <b>{money(data?.investment_reserve_balance)}</b></small>
          </>
        }
        actions={
          <>
            <span className="mr-1"><HeaderButton icon="icon-pencil" title="Send reserve" onClick={open} /></span>
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
            { key: "from", header: "From Account", value: () => "HQ RESERVE", render: () => "HQ RESERVE" },
            { key: "to", header: "To Account", value: () => "INVESTMENT RESERVE A/C", render: () => "INVESTMENT RESERVE A/C" },
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
                  <ApprovalActions row={row} approvePath={`bank/transfers/${row.id}/approve`} rejectPath={`bank/transfers/${row.id}/reject`} description={DESCRIPTION} />
                ) : (
                  row.status === "approved" && <ReverseButton row={row} path={`bank/transfers/${row.id}/reverse`} description={DESCRIPTION} />
                ),
            },
          ]}
          footer={
            <tr>
              <td colSpan={3}>TOTAL <small className="text-muted">(posted only)</small>:</td>
              <td><b>{money(sum(rows, (row) => (row.status === "approved" ? row.amount : 0)))}</b></td>
              <td colSpan={6} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Send Reserve To Investment" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <div className="col-12">
            <small className="text-muted">
              HQ reserve available: {money(data?.hq_reserve_balance)}. Only Super Admin, Admin or a Shareholder can approve it (never the person who requested it). On approval the amount leaves the HQ reserve and is added to the Investment RESERVE A/C.
            </small>
          </div>
        </div>
      </Modal>
    </>
  );
}
