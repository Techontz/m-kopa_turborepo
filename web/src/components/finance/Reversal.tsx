"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { money } from "@/lib/format";
import { useAction } from "@/lib/hooks";

/** Reversal fields the API adds to transfer and expense rows. */
export interface Reversible {
  id: number;
  amount: number;
  status: string;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  reversal_reference?: string | null;
  can_reverse?: boolean;
  reverse_blocked_reason?: string | null;
}

export function isReversed(row: Pick<Reversible, "status">): boolean {
  return row.status === "reversed";
}

/** REVERSED badge with who / when / why under it (the original row stays listed). */
export function ReversedStatus({ row }: { row: Reversible }) {
  return (
    <>
      <Badge tone="warning">REVERSED</Badge>
      <div className="text-muted small" style={{ whiteSpace: "normal", minWidth: 140 }}>
        {row.reversed_at?.slice(0, 10)}
        {row.reversed_by && ` by ${row.reversed_by}`}
        {row.reversal_reason && <div title={row.reversal_reason}>Reason: {row.reversal_reason}</div>}
        {row.reversal_reference && <div>Ref: {row.reversal_reference}</div>}
      </div>
    </>
  );
}

interface ReverseButtonProps {
  row: Reversible;
  /** API path of the reverse endpoint for this row. */
  path: string;
  /** What is being reversed, e.g. "float to Kigoma". */
  description: string;
}

/**
 * REVERSE action: opens a reason modal and posts to the reverse endpoint. Disabled (reason in the tooltip) when the API
 * says the row cannot be reversed; hidden for rows that are not posted.
 */
export function ReverseButton({ row, path, description }: ReverseButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const reverse = useAction<{ reason: string }>("post", path);

  if (row.can_reverse === undefined || (!row.can_reverse && !row.reverse_blocked_reason)) {
    return null;
  }

  const blocked = !row.can_reverse;

  return (
    <>
      <span title={blocked ? row.reverse_blocked_reason ?? "" : "Reverse"} className="d-inline-block" style={{ maxWidth: 220, whiteSpace: "normal" }}>
        <button
          type="button"
          className={`btn btn-sm text-nowrap ${blocked ? "btn-outline-secondary" : "btn-outline-danger"}`}
          disabled={blocked || reverse.isPending}
          style={blocked ? { pointerEvents: "none" } : undefined}
          onClick={() => {
            setReason("");
            reverse.setErrors({});
            setOpen(true);
          }}
        >
          <i className={blocked ? "icon-lock" : "icon-action-undo"} /> Reverse
        </button>
        {blocked && <small className="text-muted d-block text-truncate">Blocked: {row.reverse_blocked_reason}</small>}
      </span>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reverse Transaction"
        submitLabel="Reverse"
        submitting={reverse.isPending}
        onSubmit={() => reverse.mutate({ reason }, { onSuccess: () => setOpen(false) })}
      >
        <p className="mb-2">
          Reverse <b>{money(row.amount)}</b> — {description}? The original stays listed as REVERSED and an opposite journal entry is posted today.
        </p>
        <Field label="Reason:" required error={reverse.fieldError("reason")}>
          <textarea className="form-control" rows={3} maxLength={255} minLength={3} value={reason} onChange={(event) => setReason(event.target.value)} required />
        </Field>
      </Modal>
    </>
  );
}
