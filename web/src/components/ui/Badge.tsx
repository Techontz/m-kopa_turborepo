import type { ReactNode } from "react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "primary" | "default" | "dark";

export function Badge({ tone = "default", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
