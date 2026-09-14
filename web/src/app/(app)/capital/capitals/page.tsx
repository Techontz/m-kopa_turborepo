"use client";

import { Fragment, useState } from "react";

import { ContributionHistoryModal } from "@/components/capital/ContributionHistoryModal";
import { ownershipLabel, type Contribution } from "@/components/capital/contributions";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

interface CapitalData {
  share_holders: {
    id: number;
    name: string;
    total: number;
    total_contributed: number;
    shares: number;
    ownership_percent: number;
    holding_value: number;
    capitals: Contribution[];
  }[];
  share_holder_capital: number;
  company_cash_balance: number;
  bank_balances: { id: number; name: string; balance: number }[];
  bank_balance_total: number;
  capital_account: number;
}

interface CompanyPosition {
  shareholder_contributions: { total: number };
  balances: { company_cash: number; banks: { id: number; name: string; balance: number }[]; bank_total: number; branch_lending_cash: number; total_cash_and_bank: number };
  income: number;
  expenses: number;
  net_income: number;
  loans: { disbursed_count: number; disbursed_total: number; outstanding_principal: number };
  capital_account_ledger: number;
}

interface CapitalForm {
  share_id: string;
  amount: string;
  pay_method: string;
  bank_account_id: string;
  recept: string;
  chaque_no: string;
  receipt_file: File | null;
}

const EMPTY: CapitalForm = { share_id: "", amount: "", pay_method: "", bank_account_id: "", recept: "", chaque_no: "", receipt_file: null };
const RECEIPT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function toFormData(form: CapitalForm, idempotencyKey: string): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(form)) {
    if (key === "bank_account_id" && form.pay_method !== "BANK") {
      continue;
    }
    if (value instanceof File) {
      body.append(key, value);
    } else if (value !== null && value !== "") {
      body.append(key, value);
    }
  }
  body.append("idempotency_key", idempotencyKey);
  return body;
}

/**
 * Live admin/capital. Every contribution is its own row posted Dr the receiving company account (COMPANY ACCOUNT for
 * CASH, the chosen bank account for BANK) / Cr CAPITAL ACCOUNT; entries are never deleted (corrections are reversals),
 * so the live per-row delete button is not offered. Contributions are financial records; ownership % comes only from the
 * share register (Shares module). What the company holds now (cash, banks, loans, income, expenses) is shown separately
 * in Company Capital Position.
 */
export default function CapitalsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<CapitalData>("capital/capitals");
  const { data: position } = useApi<CompanyPosition>("capital/position");
  const [form, setForm] = useState<CapitalForm>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey("capital"));
  const [receiptFor, setReceiptFor] = useState<Contribution | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [historyOf, setHistoryOf] = useState<number | null>(null);
  const create = useAction<FormData>("post", "capital/capitals");
  const replaceReceipt = useAction<FormData>("post", () => `capital/capitals/${receiptFor?.id}/receipt`);
  const canManage = can("capital.manage");
  const set = (field: keyof CapitalForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader crumbs={["Capital"]} />

      {canManage && (
        <Card title="Add Capital">
          <form
            key={formKey}
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(toFormData(form, idempotencyKey), {
                onSuccess: () => {
                  setForm(EMPTY);
                  setFormKey((key) => key + 1);
                  setIdempotencyKey(newIdempotencyKey("capital"));
                },
              });
            }}
          >
            <div className="row">
              <Field label=" Shareholder Name:" required className="col-lg-4" error={create.fieldError("share_id")}>
                <SelectBox placeholder="Select Shareholder" optionsUrl="capital/options/share-holders" value={form.share_id} onChange={(value) => setForm({ ...form, share_id: value ?? "" })} />
              </Field>
              <Field label="Amount:" required className="col-lg-4" error={create.fieldError("amount")}>
                <input type="number" className="form-control input-sm" placeholder="Amount" autoComplete="off" value={form.amount} onChange={set("amount")} required />
              </Field>
              <Field label="Pay Method:" required className="col-lg-4" error={create.fieldError("pay_method")}>
                <select className="form-control input-sm" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value, bank_account_id: "" })} required>
                  <option value="">Select</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
              </Field>
              <Field label="Receiving Account:" required className="col-lg-4" error={create.fieldError("bank_account_id")}>
                {form.pay_method === "BANK" ? (
                  <SelectBox placeholder="Select Bank Account" optionsUrl="capital/options/bank-accounts" value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
                ) : (
                  <input className="form-control input-sm" readOnly value={form.pay_method === "CASH" ? "COMPANY ACCOUNT (cash)" : "Select pay method first"} />
                )}
              </Field>
              <Field label="Receipt no:" required className="col-lg-4" error={create.fieldError("recept")}>
                <input type="number" className="form-control input-sm" placeholder="Receipt" autoComplete="off" value={form.recept} onChange={set("recept")} />
              </Field>
              <Field label="Cheque Number:" required className="col-lg-4" error={create.fieldError("chaque_no")}>
                <input type="number" className="form-control input-sm" placeholder="Cheque number" autoComplete="off" value={form.chaque_no} onChange={set("chaque_no")} />
              </Field>
              <Field label="Import Receipt:" className="col-lg-4">
                <FileField
                  file={form.receipt_file}
                  onChange={(file) => setForm({ ...form, receipt_file: file })}
                  accept={RECEIPT_ACCEPT}
                  extensions={RECEIPT_EXTENSIONS}
                  maxMb={5}
                  placeholder="Upload receipt (PDF / image)"
                  error={create.fieldError("receipt_file")}
                />
              </Field>
            </div>
            <p className="mb-0"><small className="text-muted">Posting: Dr receiving account (COMPANY ACCOUNT or the bank) / Cr CAPITAL ACCOUNT. Contributions are financial records — ownership comes from shares in the share register (Shares → Issue Shares can record a paid issuance in one step).</small></p>
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Save</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Shareholder Contributions">
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr><th>S/No</th><th>Shareholder</th><th>Amount</th><th>Pay Method</th><th>Receiving Account</th><th>Receipt No</th><th>Cheque No</th><th>Date</th><th>Recorded By</th><th>Journal Ref / Shares</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={11} className="mf-loading">Loading...</td></tr>}
              {data?.share_holders.map((holder, index) => (
                <Fragment key={holder.id}>
                  <tr>
                    <td>{index + 1}.</td>
                    <td><b>{holder.name}</b></td>
                    <td><b>{money(holder.total_contributed)}</b></td>
                    <td colSpan={7}>{holder.capitals.length} contribution{holder.capitals.length === 1 ? "" : "s"} · Share register: <b>{holder.shares.toLocaleString("en-US")}</b> shares, ownership <b>{ownershipLabel(holder.ownership_percent)}</b></td>
                    <td><button type="button" className="btn btn-sm btn-icon btn-info" title="Contribution history" onClick={() => setHistoryOf(holder.id)}><i className="icon-list" /></button></td>
                  </tr>
                  {holder.capitals.map((capital) => (
                    <tr key={capital.id}>
                      <td /><td />
                      <td>{money(capital.amount)}</td>
                      <td>{capital.pay_method}</td>
                      <td>{capital.receiving_account_label ?? "—"}</td>
                      <td>{capital.receipt_number || "-"}</td>
                      <td>{capital.cheque_number || "-"}</td>
                      <td>{capital.contributed_at}</td>
                      <td>{capital.recorded_by ?? "—"}</td>
                      <td>{capital.journal_reference ?? "—"}{capital.share_transaction_reference && <><br /><small className="text-muted">Shares: {capital.share_transaction_reference}</small></>}</td>
                      <td className="text-nowrap">
                        {capital.receipt_endpoint ? (
                          <a href={backendUrl(capital.receipt_endpoint)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-icon btn-info mr-1" title={`View receipt: ${capital.receipt_file_name ?? ""}`}>
                            <i className="icon-doc" />
                          </a>
                        ) : (
                          <span className="text-muted mr-1" title="No receipt uploaded">No receipt</span>
                        )}
                        {canManage && (
                          <button type="button" className="btn btn-sm btn-icon btn-primary" title={capital.receipt_endpoint ? "Replace receipt" : "Import receipt"} onClick={() => { setReplacement(null); setReceiptFor(capital); }}>
                            <i className="icon-cloud-upload" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><b>TOTAL SHAREHOLDER CONTRIBUTIONS</b></td><td><b>{money(data?.share_holder_capital)}</b></td><td colSpan={8}><small>Historical contributions (financial records). Ownership % comes from the share register, not from contributions.</small></td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="Company Capital Position">
        <p className="mb-2"><small className="text-muted">What the company holds and earns today. These balances change as money is spent, transferred or lent; they never change share ownership.</small></p>
        <div className="table-responsive">
          <table className="table table-hover table-custom mb-0">
            <tbody>
              <tr className="thead-info"><th colSpan={2}>Shareholder capital</th></tr>
              <tr><td>Historical shareholder contributions</td><td className="text-right"><b>{money(position?.shareholder_contributions.total ?? data?.share_holder_capital)}</b></td></tr>
              <tr><td>CAPITAL ACCOUNT (ledger balance — includes bank opening balances and reinvested profit)</td><td className="text-right">{money(position?.capital_account_ledger ?? data?.capital_account)}</td></tr>
              <tr className="thead-info"><th colSpan={2}>Company cash &amp; bank (current balances)</th></tr>
              <tr><td>Company Cash — COMPANY ACCOUNT</td><td className="text-right"><b>{money(position?.balances.company_cash ?? data?.company_cash_balance)}</b></td></tr>
              {(position?.balances.banks ?? data?.bank_balances ?? []).map((bank) => (
                <tr key={bank.id}><td>Bank — {bank.name}</td><td className="text-right">{money(bank.balance)}</td></tr>
              ))}
              <tr><td>Total bank balances</td><td className="text-right"><b>{money(position?.balances.bank_total ?? data?.bank_balance_total)}</b></td></tr>
              <tr><td>Branch lending cash — PRINCIPAL A/C (all branches)</td><td className="text-right">{money(position?.balances.branch_lending_cash)}</td></tr>
              <tr className="thead-info"><th colSpan={2}>Company performance &amp; loans</th></tr>
              <tr><td>Company income</td><td className="text-right">{money(position?.income)}</td></tr>
              <tr><td>Company expenses</td><td className="text-right">{money(position?.expenses)}</td></tr>
              <tr><td>Net income</td><td className="text-right"><b>{money(position?.net_income)}</b></td></tr>
              <tr><td>Loans disbursed ({position?.loans.disbursed_count ?? 0})</td><td className="text-right">{money(position?.loans.disbursed_total)}</td></tr>
              <tr><td>Loans outstanding — LOAN RECEIVABLE</td><td className="text-right"><b>{money(position?.loans.outstanding_principal)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <ContributionHistoryModal shareHolderId={historyOf} onClose={() => setHistoryOf(null)} />

      <Modal
        open={receiptFor !== null}
        onClose={() => setReceiptFor(null)}
        title={receiptFor?.receipt_endpoint ? "Replace Receipt" : "Import Receipt"}
        submitLabel="Upload"
        submitting={replaceReceipt.isPending}
        onSubmit={() => {
          if (!replacement) {
            replaceReceipt.setErrors({ receipt_file: ["Choose the receipt file to upload"] });
            return;
          }
          const body = new FormData();
          body.append("receipt_file", replacement);
          replaceReceipt.mutate(body, { onSuccess: () => setReceiptFor(null) });
        }}
      >
        {receiptFor && (
          <>
            <p className="mb-2">
              Amount <b>{money(receiptFor.amount)}</b> · {receiptFor.pay_method} · Receipt no {receiptFor.receipt_number || "-"}
              {receiptFor.receipt_file_name && <><br />Current file: {receiptFor.receipt_file_name}</>}
            </p>
            <FileField file={replacement} onChange={setReplacement} accept={RECEIPT_ACCEPT} extensions={RECEIPT_EXTENSIONS} maxMb={5} placeholder="Upload receipt (PDF / image)" error={replaceReceipt.fieldError("receipt_file")} />
          </>
        )}
      </Modal>
    </>
  );
}
