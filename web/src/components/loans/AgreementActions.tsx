"use client";

import Link from "next/link";
import { useState } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/lib/auth";
import { useAction } from "@/lib/hooks";

import { agreementPath } from "./agreement";
import type { Loan } from "./types";

type AgreementLoan = Pick<Loan, "id" | "agreement_file" | "agreement_available"> & { customer_name?: string };

/** Who may upload the customer's signed copy (same permissions as the API). */
export const AGREEMENT_UPLOADERS = ["loans.apply", "loans.approve_manager", "loans.disburse"];

/**
 * Loan agreement buttons: print the generated agreement, open the uploaded signed copy, upload (or replace) it.
 * Nothing is shown before the branch manager approves. `compact` renders icon buttons for table rows; `showPrint` is
 * off on the agreement page itself.
 */
export function AgreementActions({ loan, compact = false, showPrint = true }: { loan: AgreementLoan; compact?: boolean; showPrint?: boolean }) {
  const { can } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const upload = useAction<FormData>("post", `loans/${loan.id}/agreement`);

  if (!loan.agreement_available) {
    return null;
  }

  const size = compact ? "btn-sm btn-icon mr-1" : "mr-1 mb-1";
  const uploaded = loan.agreement_file !== null;

  return (
    <>
      {showPrint && (
        <Link href={agreementPath(loan.id)} className={`btn btn-secondary ${size}`} title="Print loan agreement">
          <i className="icon-printer" />{!compact && " Print Agreement"}
        </Link>
      )}
      {uploaded && (
        <a href={loan.agreement_file ?? undefined} target="_blank" rel="noreferrer" className={`btn btn-success ${size}`} title="Signed agreement">
          <i className="icon-doc" />{!compact && " Signed Agreement"}
        </a>
      )}
      {can(AGREEMENT_UPLOADERS) && (
        <button type="button" className={`btn ${uploaded ? "btn-outline-primary" : "btn-primary"} ${size}`} title={uploaded ? "Replace signed agreement" : "Upload signed agreement"} onClick={() => { setFile(null); setOpen(true); }}>
          <i className="icon-cloud-upload" />{!compact && (uploaded ? " Replace Signed Agreement" : " Upload Signed Agreement")}
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Upload Signed Loan Agreement${loan.customer_name ? ` — ${loan.customer_name}` : ""}`}
        submitLabel="Upload"
        submitting={upload.isPending}
        onSubmit={() => {
          const form = new FormData();
          if (file) {
            form.append("attach", file);
          }
          upload.mutate(form, { onSuccess: () => setOpen(false) });
        }}
      >
        <p className="mb-2">Scan the agreement filled and signed by the customer (and guarantors) into one PDF.</p>
        <Field label="Signed Loan Agreement (PDF)" required className="col-md-12 px-0" error={upload.fieldError("attach")}>
          <input type="file" accept="application/pdf" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </Field>
      </Modal>
    </>
  );
}
