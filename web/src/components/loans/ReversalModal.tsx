"use client";

import { useState, type ReactNode } from "react";

import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";

interface ReversalModalProps {
  open: boolean;
  title: string;
  /** What the reversal undoes (amount split, accounts restored). */
  summary: ReactNode;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

/** Reason (3–255 characters) and confirmation for a money reversal; the server re-checks every dependency. */
export function ReversalModal({ open, title, summary, submitting, error, onClose, onSubmit }: ReversalModalProps) {
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };

  return (
    <Modal open={open} onClose={close} title={title} submitLabel="Reverse" submitting={submitting} onSubmit={() => onSubmit(reason.trim())}>
      <div className="alert alert-warning">{summary}</div>
      <Field label="Reason:" required className="col-12 px-0" error={error}>
        <textarea className="form-control" rows={3} minLength={3} maxLength={255} value={reason} onChange={(event) => setReason(event.target.value)} required />
      </Field>
    </Modal>
  );
}
