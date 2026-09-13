"use client";

import { Card } from "@/components/ui/Card";
import { money } from "@/lib/format";

import type { DisbursementChain, JournalEntrySummary, LoanDetail } from "./types";

function EntryLines({ entry }: { entry: JournalEntrySummary }) {
  return (
    <div className="table-responsive"><table className="table table-sm mb-2">
      <thead className="thead-info"><tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
      <tbody>
        {entry.lines.map((line, index) => (
          <tr key={index}><td>{line.code} {line.account}</td><td className="text-right">{line.debit ? money(line.debit) : ""}</td><td className="text-right">{line.credit ? money(line.credit) : ""}</td></tr>
        ))}
      </tbody>
    </table></div>
  );
}

/**
 * Traceable disbursement chain: Customer → Loan → Approval → Disbursement → source account → journal entry, plus the
 * customer's loan account as posted in the ledger (LOAN RECEIVABLE movements of this loan and its repayments).
 */
export function DisbursementChainCard({ chain, ledger }: { chain: DisbursementChain; ledger: LoanDetail["ledger"] }) {
  const { disbursement, journal_entry: entry } = chain;
  const steps: { label: string; value: React.ReactNode }[] = [
    { label: "Customer", value: <>{chain.customer.name}{chain.customer.code ? ` (${chain.customer.code})` : ""}</> },
    { label: "Loan", value: <>{chain.loan.loan_number} · Ref {chain.loan.reference_number ?? "—"} · Approved {money(chain.loan.amount_approved)}</> },
    { label: "Approval", value: <>Manager: {chain.manager_approval ? `${chain.manager_approval.by}, ${chain.manager_approval.at}` : "—"} · Credit: {chain.credit_approval ? `${chain.credit_approval.by}, ${chain.credit_approval.at}` : "—"}</> },
    { label: "Disbursement", value: <>Batch {disbursement.batch_id} · {disbursement.channel.toUpperCase()} · <span className={`badge badge-${disbursement.status === "success" ? "success" : disbursement.status === "failed" || disbursement.status === "cancelled" ? "danger" : "info"}`}>{disbursement.status.toUpperCase()}</span> · Sent {money(disbursement.amount)}{disbursement.provider_reference ? ` · Provider ref ${disbursement.provider_reference}` : ""}</> },
    { label: "Source account", value: <b>{disbursement.source_label}</b> },
    { label: "Destination", value: <>{disbursement.destination} (customer loan account)</> },
    { label: "Journal entry", value: entry ? <><b>{entry.reference}</b> · {entry.description}</> : "Not posted (no successful disbursement)" },
    { label: "Date / time", value: disbursement.completed_at ?? entry?.created_at ?? "—" },
  ];

  return (
    <Card title="Disbursement Chain">
      <div className="row">
        <div className="col-lg-6">
          <table className="table table-sm mb-2">
            <tbody>
              {steps.map((step, index) => (
                <tr key={step.label}><th className="text-nowrap">{index + 1}. {step.label}</th><td>{step.value}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col-lg-6">
          {entry && <EntryLines entry={entry} />}
          <p className="mb-1">Customer loan account (LOAN RECEIVABLE) balance from ledger postings: <b>{money(ledger.receivable_balance)}</b></p>
          <div className="table-responsive">
            <table className="table table-sm mb-0">
              <thead className="thead-info"><tr><th>Date</th><th>Journal Ref</th><th>Description</th><th className="text-right">Receivable Dr</th><th className="text-right">Receivable Cr</th></tr></thead>
              <tbody>
                {ledger.entries.map((row) => {
                  const receivable = row.lines.filter((line) => line.key === "loan_receivable");
                  const debit = receivable.reduce((total, line) => total + Number(line.debit), 0);
                  const credit = receivable.reduce((total, line) => total + Number(line.credit), 0);
                  return (
                    <tr key={row.id}><td>{row.entry_date}</td><td>{row.reference}</td><td>{row.description}</td><td className="text-right">{debit ? money(debit) : ""}</td><td className="text-right">{credit ? money(credit) : ""}</td></tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Card>
  );
}
