"use client";

import { useState } from "react";

import { confirmAction } from "@/components/ui/notify";

import type { DraftResource } from "../types";

interface Props {
  drafts: DraftResource[];
  currentEmployeeId: number | null;
  busyId: number | null;
  onResume: (draft: DraftResource) => void;
  onDiscard: (draft: DraftResource) => void;
  onNotNow: () => void;
}

function when(value: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "Saved registrations (N)" — server drafts, collapsed by default. */
export function SavedRegistrations({ drafts, currentEmployeeId, busyId, onResume, onDiscard, onNotNow }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="mf-drafts" aria-label="Saved registrations">
      <div className="mf-drafts-head">
        <button type="button" className="mf-drafts-toggle" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
          <i className={expanded ? "fa fa-chevron-down" : "fa fa-chevron-right"} />
          <b>Saved registrations ({drafts.length})</b>
          <span className="mf-drafts-note">{expanded ? "Unfinished and waiting. These are held on the server, so they can be resumed from any device." : "Hidden — select to show them again."}</span>
        </button>
        <button type="button" className="btn btn-sm btn-link" onClick={onNotNow}>
          Not now
        </button>
      </div>
      {expanded && (
        <ul className="mf-drafts-list">
          {drafts.map((draft) => {
            const own = draft.isOwn ?? (currentEmployeeId !== null && draft.createdById === currentEmployeeId);
            return (
              <li key={draft.id}>
                <div className="mf-drafts-main">
                  <div className="mf-drafts-label">{draft.label}</div>
                  <div className="mf-drafts-meta">
                    {[draft.phone, own ? "Yours" : draft.createdByName ?? "Another officer", when(draft.updatedAt)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="mf-drafts-actions">
                  <button type="button" className="btn btn-sm btn-primary" disabled={busyId === draft.id} onClick={() => onResume(draft)}>
                    Resume
                  </button>
                  {own && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      aria-label={`Discard ${draft.label}`}
                      title="Discard"
                      disabled={busyId === draft.id}
                      onClick={async () => (await confirmAction("Discard this saved registration?")) && onDiscard(draft)}
                    >
                      <i className="icon-trash" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
