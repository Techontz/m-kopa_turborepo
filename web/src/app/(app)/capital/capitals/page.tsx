"use client";

import Link from "next/link";
import { Fragment, useState } from "react";

import { AssetContributionFields } from "@/components/capital/assets/AssetContributionFields";
import { assetPayload, emptyAssetForm, findType, type AssetConfig, type AssetForm, type AssetRow } from "@/components/capital/assets/assets";
import { ContributionHistoryModal } from "@/components/capital/ContributionHistoryModal";
import { ApprovalActions, ApprovalStatus } from "@/components/finance/Approval";
import { ReverseButton, ReversedStatus } from "@/components/finance/Reversal";
import { ownershipLabel, payMethodTone, type Contribution } from "@/components/capital/contributions";
import { Badge } from "@/components/ui/Badge";
import { Loading } from "@/components/ui/Loading";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { SelectBox } from "@/components/ui/SelectBox";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money, todayIso } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";
import { newIdempotencyKey } from "@/lib/idempotency";

interface CapitalData {
  share_holders: {
    id: number;
    name: string;
    total: number;
    total_contributed: number;
    cash_contributed: number;
    bank_contributed: number;
    asset_contributed: number;
    shares: number;
    ownership_percent: number;
    holding_value: number;
    capitals: Contribution[];
  }[];
  share_holder_capital: number;
  contribution_breakdown?: { cash: number; bank: number; asset: number; total: number };
  company_cash_balance: number;
  bank_balances: { id: number; name: string; balance: number }[];
  bank_balance_total: number;
  capital_account: number;
}

interface LedgerLine {
  key: string;
  label: string;
  amount: number;
}

interface CompanyPosition {
  shareholder_contributions: { total: number };
  balances: {
    company_cash: number;
    banks: { id: number; name: string; balance: number }[];
    bank_total: number;
    lending_cash: number;
    total_cash_and_bank: number;
    total_cash_and_bank_label: string;
    money_groups: LedgerLine[];
    total_money_assets: number;
  };
  income: number;
  income_breakdown: LedgerLine[];
  reserve_from_interest: number;
  expenses: number;
  expense_breakdown: LedgerLine[];
  net_income: number;
  from: string | null;
  to: string | null;
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
/** "2026-06" → the month's first and last day for the position filter; no filter (all time) when empty. */
function monthRange(month: string): Record<string, string> | undefined {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) {
    return undefined;
  }
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export default function CapitalsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<CapitalData>("capital/capitals");
  const [positionMonth, setPositionMonth] = useState("");
  const { data: position } = useApi<CompanyPosition>("capital/position", monthRange(positionMonth));
  const [form, setForm] = useState<CapitalForm>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey("capital"));
  const [receiptFor, setReceiptFor] = useState<Contribution | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const [historyOf, setHistoryOf] = useState<number | null>(null);
  const create = useAction<FormData>("post", "capital/capitals");
  const { data: assetConfig } = useApi<AssetConfig>("capital/assets/config");
  const [assetForm, setAssetForm] = useState<AssetForm>(() => emptyAssetForm(todayIso()));
  const [createdAsset, setCreatedAsset] = useState<AssetRow | null>(null);
  const createAsset = useAction<Record<string, unknown>, { message: string; data: AssetRow }>("post", "capital/assets");
  const isAsset = form.pay_method === "ASSET";
  const fieldError = (field: string) => (isAsset ? createAsset.fieldError(field) : create.fieldError(field));
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
              if (isAsset) {
                if (!form.share_id) {
                  createAsset.setErrors({ share_id: ["Select the shareholder"] });
                  return;
                }
                createAsset.mutate(assetPayload(form.share_id, assetForm, findType(assetConfig, assetForm.asset_type), idempotencyKey), {
                  onSuccess: (result) => {
                    setCreatedAsset(result.data);
                    setForm(EMPTY);
                    setAssetForm(emptyAssetForm(todayIso()));
                    setFormKey((key) => key + 1);
                    setIdempotencyKey(newIdempotencyKey("capital"));
                  },
                });
                return;
              }
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
              <Field label=" Shareholder Name:" required className="col-lg-4" error={fieldError("share_id")}>
                <SelectBox inputId="capital-share-holder" placeholder="Select Shareholder" optionsUrl="capital/options/share-holders" value={form.share_id} onChange={(value) => setForm({ ...form, share_id: value ?? "" })} />
              </Field>
              <Field label="Pay Method:" required className="col-lg-4" error={create.fieldError("pay_method")}>
                <select id="capital-pay-method" className="form-control input-sm" value={form.pay_method} onChange={(e) => setForm({ ...form, pay_method: e.target.value, bank_account_id: "" })} required>
                  <option value="">Select</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                  <option value="ASSET">ASSET</option>
                </select>
              </Field>
              {!isAsset && (
              <Field label="Amount:" required className="col-lg-4" error={create.fieldError("amount")}>
                <input type="number" className="form-control input-sm" placeholder="Amount" autoComplete="off" value={form.amount} onChange={set("amount")} required />
              </Field>
              )}
              {!isAsset && (<>
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
              </>)}
            </div>
            {isAsset && <AssetContributionFields config={assetConfig} form={assetForm} onChange={setAssetForm} fieldError={createAsset.fieldError} />}
            {!isAsset && <p className="mb-0"><small className="text-muted">Recorded as PENDING; another authorised user approves it, which posts Dr receiving account (COMPANY ACCOUNT or the bank) / Cr CAPITAL ACCOUNT. Pending contributions do not count in totals, ownership or dividends. Contributions are financial records — ownership comes from shares in the share register (Shares → Issue Shares can record a paid issuance in one step).</small></p>}
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending || createAsset.isPending}><i className="icon-drawer" />Save</button>
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
              {isLoading && <tr><td colSpan={11} className="mf-loading"><Loading inline /></td></tr>}
              {data?.share_holders.map((holder, index) => (
                <Fragment key={holder.id}>
                  <tr>
                    <td>{index + 1}.</td>
                    <td><b>{holder.name}</b></td>
                    <td><b>{money(holder.total_contributed)}</b></td>
                    <td colSpan={7}>{holder.capitals.length} contribution{holder.capitals.length === 1 ? "" : "s"} · Cash <b>{money(holder.cash_contributed)}</b> · Bank <b>{money(holder.bank_contributed)}</b> · Asset <b>{money(holder.asset_contributed)}</b> · Share register: <b>{holder.shares.toLocaleString("en-US")}</b> shares, ownership <b>{ownershipLabel(holder.ownership_percent)}</b></td>
                    <td><button type="button" className="btn btn-sm btn-icon btn-info" title="Contribution history" onClick={() => setHistoryOf(holder.id)}><i className="icon-list" /></button></td>
                  </tr>
                  {holder.capitals.map((capital) => (
                    <tr key={capital.id}>
                      <td /><td />
                      <td>{capital.reversed || capital.status === "rejected" || capital.status === "cancelled" ? <s title={capital.reversed ? `Reversed: ${capital.reversal_reason ?? ""}` : capital.status === "cancelled" ? "Cancelled by the shareholder" : `Rejected: ${capital.rejection_reason ?? ""}`}>{money(capital.amount)}</s> : capital.status === "pending" ? <span className="text-muted" title="Pending approval — not counted">{money(capital.amount)}</span> : money(capital.amount)}</td>
                      <td>
                        <Badge tone={payMethodTone(capital.pay_method)}>{capital.pay_method}</Badge>
                        {capital.asset_id && <><br /><Link href={`/capital/assets/${capital.asset_id}`} title={capital.asset_name ?? ""}>{capital.asset_code}</Link></>}
                        {capital.reversed && <><br /><ReversedStatus row={{ ...capital, status: "reversed" }} /></>}
                        {(capital.status === "pending" || capital.status === "rejected") && <><br /><ApprovalStatus row={{ ...capital, status: capital.status }} /></>}
                      </td>
                      <td>{capital.receiving_account_label ?? "—"}</td>
                      <td>{capital.receipt_number || "-"}</td>
                      <td>{capital.cheque_number || "-"}</td>
                      <td>{capital.contributed_at}</td>
                      <td>
                        {capital.recorded_by ?? "—"}
                        {capital.source === "shareholder_portal" && <><br /><Badge tone="info">{capital.source_label ?? "Submitted by shareholder"}</Badge></>}
                        {capital.status === "cancelled" && <><br /><Badge tone="default">CANCELLED BY SHAREHOLDER</Badge></>}
                      </td>
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
                        {capital.status === "pending" && (
                          <div className="mt-1" style={{ whiteSpace: "normal" }}>
                            <ApprovalActions
                              row={{ ...capital, status: "pending" }}
                              approvePath={`capital/capitals/${capital.id}/approve`}
                              rejectPath={`capital/capitals/${capital.id}/reject`}
                              description={`${capital.pay_method} capital contribution of ${holder.name} (Dr ${capital.receiving_account_label ?? "receiving account"} / Cr CAPITAL ACCOUNT)`}
                            />
                          </div>
                        )}
                        {!capital.reversed && (capital.status ?? "posted") === "posted" && (
                          <div className="mt-1" style={{ whiteSpace: "normal" }}>
                            <ReverseButton
                              row={{ ...capital, status: capital.status ?? "posted" }}
                              path={`capital/capitals/${capital.id}/reverse`}
                              description={`${capital.pay_method} capital contribution of ${holder.name} (Dr CAPITAL ACCOUNT / Cr ${capital.receiving_account_label ?? "receiving account"})`}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2}><b>TOTAL SHAREHOLDER CONTRIBUTIONS</b></td><td><b>{money(data?.share_holder_capital)}</b></td><td colSpan={8}><small>Cash {money(data?.contribution_breakdown?.cash)} · Bank {money(data?.contribution_breakdown?.bank)} · Asset {money(data?.contribution_breakdown?.asset)}. Historical contributions (financial records). Ownership % comes from the share register, not from contributions.</small></td></tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        title="Company Capital Position"
        actions={
          <label className="mb-0 d-flex align-items-center">
            <small className="mr-2">Income &amp; expenses for</small>
            <input type="month" className="form-control form-control-sm" value={positionMonth} onChange={(e) => setPositionMonth(e.target.value)} aria-label="Income and expenses month" />
            {positionMonth && <button type="button" className="btn btn-sm btn-default ml-1" onClick={() => setPositionMonth("")}>All time</button>}
          </label>
        }
      >
        <p className="mb-2"><small className="text-muted">Balances are what the company holds today. Income and expenses are ledger movements {position?.from ? `from ${position.from} to ${position.to}` : "for all time"} (month-end closing entries excluded). These figures never change share ownership.</small></p>
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
              <tr><td>Lending cash — PRINCIPAL A/C (HQ funds every loan)</td><td className="text-right">{money(position?.balances.lending_cash)}</td></tr>
              <tr><td><b>Total cash &amp; bank</b> — {position?.balances.total_cash_and_bank_label}</td><td className="text-right"><b>{money(position?.balances.total_cash_and_bank)}</b></td></tr>
              <tr className="thead-info"><th colSpan={2}>All money accounts by group (current balances)</th></tr>
              {(position?.balances.money_groups ?? []).map((group) => (
                <tr key={group.key}><td>{group.label}</td><td className="text-right">{money(group.amount)}</td></tr>
              ))}
              <tr><td><b>Total money held (all groups)</b></td><td className="text-right"><b>{money(position?.balances.total_money_assets)}</b></td></tr>
              <tr className="thead-info"><th colSpan={2}>Company performance {position?.from ? `(${position.from} – ${position.to})` : "(all time)"} &amp; loans</th></tr>
              {(position?.income_breakdown ?? []).map((line) => (
                <tr key={line.key}><td className="pl-4">{line.label}</td><td className="text-right">{money(line.amount)}</td></tr>
              ))}
              <tr><td>Company income — gross ledger income (interest before reserve, fees, penalties, insurance, recoveries)</td><td className="text-right">{money(position?.income)}</td></tr>
              <tr><td className="pl-4">of which reserve set aside from interest</td><td className="text-right">{money(position?.reserve_from_interest)}</td></tr>
              {(position?.expense_breakdown ?? []).map((line) => (
                <tr key={line.key}><td className="pl-4">{line.label}</td><td className="text-right">{money(line.amount)}</td></tr>
              ))}
              <tr><td>Company expenses</td><td className="text-right">{money(position?.expenses)}</td></tr>
              <tr><td>Net income (gross income − expenses)</td><td className="text-right"><b>{money(position?.net_income)}</b></td></tr>
              <tr><td>Loans disbursed ({position?.loans.disbursed_count ?? 0})</td><td className="text-right">{money(position?.loans.disbursed_total)}</td></tr>
              <tr><td>Loans outstanding — LOAN RECEIVABLE</td><td className="text-right"><b>{money(position?.loans.outstanding_principal)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <ContributionHistoryModal shareHolderId={historyOf} onClose={() => setHistoryOf(null)} />

      <Modal open={createdAsset !== null} onClose={() => setCreatedAsset(null)} title={`Asset Capital Recorded — ${createdAsset?.asset_code ?? ""}`}>
        {createdAsset && (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised API image stream */}
            <img src={backendUrl(createdAsset.qr_endpoint)} alt={`QR code ${createdAsset.asset_code}`} width={180} height={180} className="mb-2" />
            <p className="mb-1"><b>{createdAsset.asset_code}</b> · {createdAsset.name} · {createdAsset.asset_type_label}</p>
            <p className="mb-2">Contribution value <b>{money(createdAsset.contribution_value)}</b> · {createdAsset.branch} · Dr {createdAsset.ledger_account_label} / Cr CAPITAL ACCOUNT</p>
            {createdAsset.status === "pending" && <p className="alert alert-warning mb-2">Awaiting approval by another authorised user: nothing is posted until it is approved on the asset page.</p>}
            <Link href={`/capital/assets/${createdAsset.id}`} className="btn btn-primary btn-sm mr-1">View Asset</Link>
            <Link href={`/capital/assets/${createdAsset.id}/label`} className="btn btn-info btn-sm mr-1"><i className="icon-printer" /> Print Label</Link>
            <a href={backendUrl(`${createdAsset.qr_endpoint}?download=1`)} className="btn btn-secondary btn-sm"><i className="icon-cloud-download" /> Download QR</a>
          </div>
        )}
      </Modal>

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
