"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import "@/styles/customers.css";

import { freezeView, type CustomerFreeze } from "./freeze";

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

function FreezeDetails({ freeze, eligible }: { freeze: CustomerFreeze | null | undefined; eligible?: boolean }) {
  const elapsed = useElapsed(Boolean(freeze?.frozen));
  const view = freezeView(freeze, elapsed);

  return (
    <div className="mf-freeze">
      <div className="d-flex flex-wrap align-items-center" style={{ gap: "0.5rem" }}>
        {eligible !== undefined && (
          <span><b>Eligibility:</b> <Badge tone={eligible ? "success" : "danger"}>{eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</Badge></span>
        )}
        <span><b>Freeze:</b> <Badge tone={view.tone}>{view.label}</Badge></span>
        {eligible !== undefined && (
          <span><b>Can apply:</b> <Badge tone={eligible && view.state !== "frozen" ? "success" : "danger"}>{eligible && view.state !== "frozen" ? "AVAILABLE" : "BLOCKED"}</Badge></span>
        )}
      </div>
      {view.state === "frozen" && (
        <dl className="mf-dl mt-2 mb-0">
          <div><dt>Reason</dt><dd>Re-borrowing freeze period</dd></div>
          <div><dt>Remaining</dt><dd>{view.remaining}</dd></div>
          <div><dt>Freeze Until</dt><dd>{view.until}</dd></div>
          {freeze?.loan_number && <div><dt>Started by</dt><dd>{freeze.loan_number}{freeze.loan_category ? ` (${freeze.loan_category}, ${freeze.freeze_days ?? 0} days)` : ""}</dd></div>}
        </dl>
      )}
      {view.state === "expired" && <p className="text-muted mt-2 mb-0">Freeze ended {view.until}.</p>}
    </div>
  );
}

/**
 * Re-borrowing freeze shown next to eligibility: FROZEN with reason, remaining time and end, FREEZE EXPIRED, or
 * NO FREEZE. Eligibility and freeze are separate; the customer can apply only when eligible AND not frozen.
 */
export function FreezeStatus({ freeze, eligible }: { freeze: CustomerFreeze | null | undefined; eligible?: boolean }) {
  return <FreezeDetails key={freeze?.checked_at ?? "none"} freeze={freeze} eligible={eligible} />;
}
