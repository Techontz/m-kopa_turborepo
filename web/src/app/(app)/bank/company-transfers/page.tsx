"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FilterModal, HeaderButton, sum, type Filters } from "@/components/finance/FilterModal";
import type { BankTransfer } from "@/components/finance/types";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

interface TransferForm {
  direction: string;
  bank_account_id: string;
  amount: string;
  reference: string;
}

interface TransferList {
  data: BankTransfer[];
  total: number;
  company_cash_balance: number;
}

const EMPTY: TransferForm = { direction: "company_to_bank", bank_account_id: "", amount: "", reference: "" };
const DIRECTION_LABELS: Record<string, string> = { company_to_bank: "Company Cash → Bank", bank_to_company: "Bank → Company Cash" };

/**
 * Bank → Company Cash ↔ Bank Transfer: internal company fund movements between the COMPANY ACCOUNT (company cash) and a
 * company bank account. Each is a ledger transfer (Dr receiving account / Cr sending account) — totals never change.
 */
export default function CompanyTransfersPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [modal, setModal] = useState<"filter" | "transfer" | null>(null);
  const [form, setForm] = useState<TransferForm>(EMPTY);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey("transfer"));
  const { data, isLoading } = useQuery({ queryKey: ["bank/company-transfers", filters], queryFn: () => api.get<TransferList>("bank/company-transfers", { ...filters }) });
  const create = useAction<TransferForm & { idempotency_key: string }>("post", "bank/company-transfers");
  const rows = data?.data;

  const open = () => {
    setForm(EMPTY);
    setIdempotencyKey(newIdempotencyKey("transfer"));
    create.setErrors({});
    setModal("transfer");
  };

  return (
    <>
      <PageHeader crumbs={["Bank", "Company Cash ↔ Bank Transfer"]} />
      <Card
        title={<>Company Cash ↔ Bank Transfers <small className="ml-2">Company Cash (COMPANY ACCOUNT): <b>{money(data?.company_cash_balance)}</b></small></>}
        actions={
          <>
            <span className="mr-1"><HeaderButton icon="icon-pencil" title="New transfer" onClick={open} /></span>
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
            { key: "type", header: "Direction", render: (row) => DIRECTION_LABELS[row.type] ?? row.type },
            { key: "from", header: "From Account", value: (row) => (row.type === "company_to_bank" ? "COMPANY ACCOUNT" : row.bank_account ?? ""), render: (row) => (row.type === "company_to_bank" ? "COMPANY ACCOUNT" : `BANK - ${row.bank_account ?? ""}`) },
            { key: "to", header: "To Account", value: (row) => (row.type === "company_to_bank" ? row.bank_account ?? "" : "COMPANY ACCOUNT"), render: (row) => (row.type === "company_to_bank" ? `BANK - ${row.bank_account ?? ""}` : "COMPANY ACCOUNT") },
            { key: "amount", header: "Amount", render: (row) => money(row.amount) },
            { key: "reference", header: "Reference", render: (row) => row.reference || "-" },
            { key: "journal_reference", header: "Journal Ref", render: (row) => row.journal_reference ?? "—" },
            { key: "employee", header: "Recorded By", render: (row) => row.employee ?? "—" },
            { key: "created_at", header: "Date / Time" },
          ]}
          footer={
            <tr>
              <td colSpan={4}>TOTAL:</td>
              <td><b>{money(sum(rows, (row) => row.amount))}</b></td>
              <td colSpan={4} />
            </tr>
          }
        />
      </Card>

      <FilterModal open={modal === "filter"} onClose={() => setModal(null)} onApply={setFilters} />

      <Modal
        open={modal === "transfer"}
        onClose={() => setModal(null)}
        title="Company Cash ↔ Bank Transfer"
        submitLabel="Submit"
        submitting={create.isPending}
        onSubmit={() => create.mutate({ ...form, idempotency_key: idempotencyKey }, { onSuccess: () => setModal(null) })}
      >
        <div className="row clearfix">
          <Field label="Direction:" required className="col-lg-6" error={create.fieldError("direction")}>
            <select className="form-control" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} required>
              <option value="company_to_bank">Company Cash → Bank</option>
              <option value="bank_to_company">Bank → Company Cash</option>
            </select>
          </Field>
          <Field label="Bank Account:" required className="col-lg-6" error={create.fieldError("bank_account_id")}>
            <SelectBox placeholder="Select Account" optionsUrl="bank/options/accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
          </Field>
          <Field label="Amount:" required className="col-lg-6" error={create.fieldError("amount")}>
            <input type="number" className="form-control" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Reference:" className="col-lg-6" error={create.fieldError("reference")}>
            <input className="form-control" placeholder="Deposit slip / transfer reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={100} />
          </Field>
          <div className="col-12">
            <small className="text-muted">
              Posting: Dr {form.direction === "company_to_bank" ? "BANK" : "COMPANY ACCOUNT"} / Cr {form.direction === "company_to_bank" ? "COMPANY ACCOUNT" : "BANK"}. Company Cash available: {money(data?.company_cash_balance)}.
            </small>
          </div>
        </div>
      </Modal>
    </>
  );
}
