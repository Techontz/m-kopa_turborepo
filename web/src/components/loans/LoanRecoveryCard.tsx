"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { SelectBox } from "@/components/ui/SelectBox";
import { useAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

import { canRecordRecovery, isAmbiguous, previewRecoverySplit, RECOVERY_COMPONENTS, recoveryExcess, recoveryStatusLabel, recoveryStatusTone, type LoanRecoveryRow, type RecoveryPosition } from "./recovery";
import { ReversalModal } from "./ReversalModal";

const METHODS = ["CASH", "BANK", "VODACOM", "AIRTEL", "TIGO", "HALOPESA", "MPESA"];
const EMPTY_FORM = { amount: "", method: "CASH", reference: "", transaction_id: "", bank_account_id: "" };

interface Props {
  loanId: number;
  loanStatus: string;
  position: RecoveryPosition;
  recoveries?: LoanRecoveryRow[];
}

/**
 * Written-off loan (C3 Option B): written off / recovered / remaining per component (Principal → Penalty → Interest → Insurance),
 * the ambiguous flag, branch money still waiting for Finance, Record Recovery (loans.recover) and the recoveries with REVERSE
 * (loans.reverse_repayment, newest first — eligibility from the API). A Finance user's recovery posts at once; anyone else's entry
 * waits for Finance. The loan stays written off and its write-off is never changed.
 */
export function LoanRecoveryCard({ loanId, loanStatus, position, recoveries = [] }: Props) {
  const { can } = useAuth();
  const [recording, setRecording] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [target, setTarget] = useState<LoanRecoveryRow | null>(null);
  const record = useAction<typeof form>("post", `loans/${loanId}/recoveries`);
  const reverse = useAction<{ id: number; reason: string }>("post", (body) => `loans/${loanId}/recoveries/${body.id}/reverse`);
  const excess = recoveryExcess(position, Number(form.amount));
  const preview = previewRecoverySplit(position, Number(form.amount));
  const finance = can("payments.suspense");
  const struck = (row: LoanRecoveryRow, value: string) => (row.reversed ? <s className="text-muted">{value}</s> : value);

  return (
    <Card
      title={<>Recovery after Write-off <Badge tone={recoveryStatusTone(position.status)}>{recoveryStatusLabel(position.status)}</Badge></>}
      actions={canRecordRecovery(position, loanStatus) && can("loans.recover") && (
        <button type="button" className="btn btn-sm btn-primary" disabled={record.isPending} onClick={() => { setForm(EMPTY_FORM); record.setErrors({}); setRecording(true); }}>
          Record Recovery
        </button>
      )}
    >
      {isAmbiguous(position) && (
        <div className="alert alert-danger">
          <b>Component split unknown.</b> {position.ambiguous_reason} No recovery can be recorded until a controlled adjustment sets the write-off snapshot.
        </div>
      )}
      <div className="table-responsive">
        <table className="table table-custom mb-2">
          <thead className="thead-info"><tr><th /><th>Written off</th><th>Recovered</th><th>Remaining</th></tr></thead>
          <tbody>
            {position.components && RECOVERY_COMPONENTS.map((component) => (
              <tr key={component}>
                <td className="text-uppercase">{component}</td>
                <td>{money(position.components?.[component].written_off)}</td>
                <td>{money(position.components?.[component].recovered)}</td>
                <td>{money(position.components?.[component].remaining)}</td>
              </tr>
            ))}
            <tr>
              <td><b>TOTAL</b></td>
              <td>{money(position.written_off)}</td>
              <td>{money(position.recovered)}</td>
              <td><b>{money(position.unrecovered)}</b></td>
            </tr>
          </tbody>
        </table>
      </div>
      {(position.pending ?? 0) > 0 && (
        <div className="alert alert-warning py-1 mb-2">TZS {money(position.pending)} received by the branch is waiting for Finance; it is not a recovery until Finance confirms it.</div>
      )}
      <small className="text-muted d-block mb-2">
        Split Principal → Penalty → Interest → Insurance: Dr PRINCIPAL A/C / Cr WRITE-OFF EXPENSE · Dr PENALTY A/C / Cr PENALTY INCOME · Dr INTEREST A/C + RESERVE A/C / Cr INTEREST INCOME (80%) + INTEREST RESERVE (20%) · Dr INSURANCE A/C / Cr INSURANCE RESERVE. The loan stays written off; its write-off and outstanding balance are never changed.
      </small>

      {recoveries.length > 0 && (
        <DataTable
          rows={recoveries}
          searchable={false}
          rowKey={(row) => row.id}
          columns={[
            { key: "date", header: "Date" },
            {
              key: "amount",
              header: "Amount",
              render: (row) => (
                <>
                  {struck(row, money(row.amount))}
                  {row.reversed && <div><Badge tone="danger">REVERSED</Badge> <small>{row.reversed_at} · {row.reversed_by ?? "—"} · {row.reversal_reason}</small></div>}
                </>
              ),
            },
            {
              key: "split",
              header: "Principal / Penalty / Interest (reserve) / Insurance",
              sortable: false,
              render: (row) => row.legacy
                ? <small>Legacy: interest {money(row.amount)}</small>
                : <small>{money(row.principal)} / {money(row.penalty)} / {money(row.interest)} ({money(row.reserve)}) / {money(row.insurance)}</small>,
            },
            { key: "method", header: "Method" },
            { key: "reference", header: "Reference", render: (row) => row.receipt_number ?? row.reference ?? "—" },
            { key: "employee", header: "Recorded by", render: (row) => row.employee ?? "—" },
            { key: "journal_reference", header: "Journal", render: (row) => row.journal_reference ?? "—" },
            ...(can("loans.reverse_repayment")
              ? [{
                  key: "action",
                  header: "Action",
                  sortable: false,
                  render: (row: LoanRecoveryRow) => !row.reversed && (
                    <span title={row.can_reverse ? "Reverse this recovery" : row.reverse_blocked_reason ?? ""} className="d-inline-block">
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={!row.can_reverse || reverse.isPending} style={row.can_reverse ? undefined : { pointerEvents: "none" }} onClick={() => { reverse.setErrors({}); setTarget(row); }}>
                        Reverse
                      </button>
                    </span>
                  ),
                }]
              : []),
          ]}
        />
      )}

      <Modal open={recording} onClose={() => setRecording(false)} title="Record Recovery" size="lg" submitLabel="Record Recovery" submitting={record.isPending} onSubmit={() => record.mutate(form, { onSuccess: () => setRecording(false) })}>
        <div className="row">
          <Field label={`Amount (unrecovered ${money(position.unrecovered)}):`} required className="col-md-4" error={record.fieldError("amount")}>
            <input type="number" min={0.01} step="0.01" className="form-control" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          </Field>
          <Field label="Method / channel:" required className="col-md-4" error={record.fieldError("method")}>
            <select className="form-control" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </Field>
          <Field label="Transaction ID:" required={!finance && form.method !== "CASH"} className="col-md-4" error={record.fieldError("transaction_id")}>
            <input className="form-control" maxLength={100} value={form.transaction_id} onChange={(e) => setForm({ ...form, transaction_id: e.target.value })} />
          </Field>
          <Field label="Reference:" className="col-md-4" error={record.fieldError("reference")}>
            <input className="form-control" maxLength={100} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
          {finance && (
            <Field label="Bank account (blank = bank clearing):" className="col-md-4" error={record.fieldError("bank_account_id")}>
              <SelectBox placeholder="Bank clearing" optionsUrl="teller/bank-accounts" isClearable value={form.bank_account_id} onChange={(value) => setForm({ ...form, bank_account_id: value ?? "" })} />
            </Field>
          )}
          <div className="col-12">
            {Number(form.amount) > 0 && (
              <small className="d-block">
                Split preview: principal {money(preview.principal)} · penalty {money(preview.penalty)} · interest {money(preview.interest)} (reserve {money(preview.reserve)}) · insurance {money(preview.insurance)}
              </small>
            )}
            <small className="text-muted d-block">
              {finance
                ? "Finance entry: confirmed and posted now (Dr BANK / Cr SUSPENSE → Dr SUSPENSE / Cr BANK → recovery journal). The write-off is not reopened."
                : "Branch entry: held pending Finance (cash as a teller cash receipt, bank / mobile money pending approval). Nothing is posted to income until Finance confirms it."}
            </small>
            {excess > 0 && <b className="d-block" style={{ color: "var(--mf-negative)" }}>TZS {money(excess)} exceeds the unrecovered write-off balance and will be rejected.</b>}
          </div>
        </div>
      </Modal>

      <ReversalModal
        key={target?.id ?? 0}
        open={target !== null}
        title="Reverse Recovery"
        submitting={reverse.isPending}
        error={reverse.fieldError("reason")}
        onClose={() => setTarget(null)}
        onSubmit={(reason) => target && reverse.mutate({ id: target.id, reason }, { onSuccess: () => setTarget(null) })}
        summary={target && <>Reverse the recovery of <b>TZS {money(target.amount)}</b> dated {target.date}: its journal is mirrored (principal, penalty, interest + reserve, insurance) and the money returns to <b>SUSPENSE</b> (unallocated). The write-off stays as posted.</>}
      />
    </Card>
  );
}
