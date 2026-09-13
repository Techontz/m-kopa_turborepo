import { Badge } from "@/components/ui/Badge";

import type { Loan } from "./types";

/** Live outlined status badge (PENDING / ACTIVE / DEFALT ...). */
export function LoanStatusBadge({ loan }: { loan: Pick<Loan, "status_label" | "status_badge"> }) {
  return <Badge tone={loan.status_badge}>{loan.status_label}</Badge>;
}

/** Live customer status badge (NEW for pending customers on the pending list). */
export function CustomerStatusBadge({ status, label }: { status?: string; label?: string }) {
  if (status === "pending") {
    return <Badge tone="success">NEW</Badge>;
  }
  return <Badge tone={status === "out" ? "danger" : status === "close" ? "info" : "success"}>{status === "close" ? "DONE" : label ?? ""}</Badge>;
}
