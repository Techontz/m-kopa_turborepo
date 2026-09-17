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
  investment_reserve_balance: number;
  operation_principal_balance: number;
}

const EMPTY: TransferForm = { amount: "" };
const DESCRIPTION = "Investment RESERVE A/C → OPERATION PRINCIPAL";

/**
 * Bank → Send Reserve To Operation Principal, the second leg of the reserve chain and the owners' side of it. Finance sends HQ
 * reserve to the Investment RESERVE A/C (/bank/reserve-to-investment); only what has arrived there can be sent on from the
 * Investment to the OPERATION PRINCIPAL, so reserve Finance still holds at HQ can never be spent from here.
 */
export default function ReserveToPrincipalPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const { data, isLoading } = useQuery({ queryKey: ["bank/reserve-to-principal", filters], queryFn: () => api.get<TransferList>("bank/reserve-to-principal", { ...filters }) });
  const create = useAction<TransferForm>("post", "bank/reserve-to-principal");
  const rows = data?.data;

  const open = () => {
    setForm(EMPTY);
    create.setErrors({});
    setModal("transfer");
  };

  return (
    <>
      <PageHeader crumbs={["Bank", "Send Reserve To Operation Principal"]} />
      <Card
        title={
          <>
            Reserve sent to the Operation Principal
            <small className="ml-2">Investment RESERVE A/C: <b>{money(data?.investment_reserve_balance)}</b></small>
            <small className="ml-2">OPERATION PRINCIPAL: <b>{money(data?.operation_principal_balance)}</b></small>
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
            { key: "from", header: "From Account", value: () => "INVESTMENT RESERVE A/C", render: () => "INVESTMENT RESERVE A/C" },
            { key: "to", header: "To Account", value: () => "OPERATION PRINCIPAL", render: () => "OPERATION PRINCIPAL" },
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

      <Modal open={modal === "transfer"} onClose={() => setModal(null)} title="Send Reserve To Operation Principal" submitLabel="Submit" submitting={create.isPending} onSubmit={() => create.mutate(form, { onSuccess: () => setModal(null) })}>
        <div className="row clearfix">
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <div className="col-12">
            <small className="text-muted">
              Investment RESERVE A/C available: {money(data?.investment_reserve_balance)} — only reserve Finance has already sent to the Investment can be moved on. Only Super Admin, Admin or a Shareholder can approve it (never the person who requested it). On approval the amount leaves the Investment RESERVE A/C and is added to the OPERATION PRINCIPAL.
            </small>
          </div>
        </div>
      </Modal>
    </>
  );
}
