"use client";

import { Fragment, useState } from "react";

import { FileField } from "@/components/ui/FileField";

import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { backendUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction, useApi } from "@/lib/hooks";

interface CapitalRow {
  id: number;
  amount: number;
  pay_method: string;
  receipt_number: string | null;
  cheque_number: string | null;
  receipt_file_name: string | null;
  receipt_endpoint: string | null;
  created_at: string;
}

interface CapitalData {
  share_holders: {
    id: number;
    name: string;
    total: number;
    capitals: CapitalRow[];
  }[];
  share_holder_capital: number;
  company_capital: number;
}

interface CapitalForm {
  share_id: string;
  amount: string;
  pay_method: string;
  recept: string;
  chaque_no: string;
  receipt_file: File | null;
}

const EMPTY: CapitalForm = { share_id: "", amount: "", pay_method: "", recept: "", chaque_no: "", receipt_file: null };
const RECEIPT_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const RECEIPT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function toFormData(form: CapitalForm): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(form)) {
    if (value instanceof File) {
      body.append(key, value);
    } else if (value !== null && value !== "") {
      body.append(key, value);
    }
  }
  return body;
}

/**
 * Live admin/capital. Documents: capital is posted Dr Company / Cr Capital through the ledger and
 * entries are never deleted (corrections are reversals), so the live per-row delete button is not offered.
 */
export default function CapitalsPage() {
  const { can } = useAuth();
  const { data, isLoading } = useApi<CapitalData>("capital/capitals");
  const [form, setForm] = useState<CapitalForm>(EMPTY);
  const [formKey, setFormKey] = useState(0);
  const [receiptFor, setReceiptFor] = useState<CapitalRow | null>(null);
  const [replacement, setReplacement] = useState<File | null>(null);
  const create = useAction<FormData>("post", "capital/capitals");
  const replaceReceipt = useAction<FormData>("post", () => `capital/capitals/${receiptFor?.id}/receipt`);
  const canManage = can("capital.manage");
  const set = (field: keyof CapitalForm) => (event: { target: { value: string } }) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <PageHeader crumbs={["Capital"]} />

      {canManage && (
        <Card title="Add Capital">
          <form key={formKey} onSubmit={(e) => { e.preventDefault(); create.mutate(toFormData(form), { onSuccess: () => { setForm(EMPTY); setFormKey((key) => key + 1); } }); }}>
            <div className="row">
              <Field label=" Share Holder Name:" required className="col-lg-4" error={create.fieldError("share_id")}>
                <SelectBox placeholder="Select Share Holder" optionsUrl="capital/options/share-holders" value={form.share_id} onChange={(value) => setForm({ ...form, share_id: value ?? "" })} />
              </Field>
              <Field label="Amount:" required className="col-lg-4" error={create.fieldError("amount")}>
                <input type="number" className="form-control input-sm" placeholder="Amount" autoComplete="off" value={form.amount} onChange={set("amount")} required />
              </Field>
              <Field label="Pay Method:" required className="col-lg-4" error={create.fieldError("pay_method")}>
                <select className="form-control input-sm" value={form.pay_method} onChange={set("pay_method")} required>
                  <option value="">Select</option>
                  <option value="CASH">CASH</option>
                  <option value="BANK">BANK</option>
                </select>
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
            <div className="text-center m-t-20">
              <button type="submit" className="btn btn-primary" disabled={create.isPending}><i className="icon-drawer" />Save</button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Capital">
        <div className="table-responsive">
          <table className="table table-hover dataTable table-custom">
            <thead className="thead-info">
              <tr><th>S/No</th><th>Share Holder</th><th>Amount</th><th>Pay method</th><th>Receipt no</th><th>Chaque no</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="mf-loading">Loading...</td></tr>}
              {data?.share_holders.map((holder, index) => (
                <Fragment key={holder.id}>
                  <tr><td>{index + 1}.</td><td>{holder.name}</td><td /><td /><td /><td /><td /><td /></tr>
                  {holder.capitals.map((capital) => (
                    <tr key={capital.id}>
                      <td /><td />
                      <td>{money(capital.amount)}</td>
                      <td>{capital.pay_method}</td>
                      <td>{capital.receipt_number || "-"}</td>
                      <td>{capital.cheque_number || "-"}</td>
                      <td>{capital.created_at}</td>
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
              <tr><td colSpan={2}><b>SHARE HOLDER CAPITAL</b></td><td><b>{money(data?.share_holder_capital)}</b></td><td colSpan={5} /></tr>
              <tr><td colSpan={2}><b>TOTAL COMPANY CAPITAL</b></td><td><b>{money(data?.company_capital)}</b></td><td colSpan={5} /></tr>
            </tfoot>
          </table>
        </div>
      </Card>

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
