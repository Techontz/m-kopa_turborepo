"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import "@/styles/customers.css";

import { freezeView, settlementRows, type CustomerFreeze } from "./freeze";

/** Milliseconds since the freeze response arrived, ticking every 30 seconds while the customer is frozen. */
function useElapsed(active: boolean): number {
  const [mountedAt] = useState(() => Date.now());
  const [now, setNow] = useState(mountedAt);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [active]);

  return now - mountedAt;
}

function FreezeDetails({ freeze, eligible, showPrevious }: { freeze: CustomerFreeze | null | undefined; eligible?: boolean; showPrevious: boolean }) {
  const elapsed = useElapsed(Boolean(freeze?.frozen));
  const view = freezeView(freeze, elapsed);
  const previous = freeze?.previous_loan ?? null;

  return (
    <div className="mf-freeze">
      <div className="d-flex flex-wrap align-items-center" style={{ gap: "0.5rem 1.25rem" }}>
        {eligible !== undefined && (
          <span><b>Loan Eligibility:</b> <Badge tone={eligible ? "success" : "danger"}>{eligible ? "Eligible" : "Not eligible"}</Badge></span>
        )}
        <span><b>Re-borrowing Status:</b> <Badge tone={view.tone}>{view.label}</Badge></span>
      </div>
      {view.state === "frozen" && (
        <dl className="mf-dl mt-2 mb-0">
          <div><dt>Reason</dt><dd>{view.reason}</dd></div>
          <div><dt>Freeze Until</dt><dd>{view.until}</dd></div>
          <div><dt>Remaining</dt><dd>{view.remaining}</dd></div>
        </dl>
      )}
      {view.state === "frozen" && freeze?.message && <div className="alert alert-danger py-1 mt-2 mb-0">{freeze.message}</div>}
      {view.state === "expired" && <p className="text-muted mt-2 mb-0">Freeze ended {view.until}. Normal eligibility rules apply.</p>}
      {showPrevious && previous && (
        <dl className="mf-dl mt-2 mb-0">
          {settlementRows(previous).map(([label, value]) => (
            <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Loan Eligibility (normal rules) and, separately, Re-borrowing Status: Frozen with reason, freeze end and remaining
 * time while an early-settlement freeze is active, otherwise Available. The customer can apply only when eligible AND
 * not frozen. `showPrevious` adds the previous loan's disbursement / expected completion / settlement / freeze window.
 */
export function FreezeStatus({ freeze, eligible, showPrevious = true }: { freeze: CustomerFreeze | null | undefined; eligible?: boolean; showPrevious?: boolean }) {
  return <FreezeDetails key={freeze?.checked_at ?? "none"} freeze={freeze} eligible={eligible} showPrevious={showPrevious} />;
}
