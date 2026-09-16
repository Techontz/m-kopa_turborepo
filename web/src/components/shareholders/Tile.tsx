import type { ReactNode } from "react";

/** Portal figure tile (label, value from the API, optional note). */
export function Tile({ label, value, note, tone = "primary", className = "col-xl-3 col-lg-4 col-sm-6" }: { label: string; value: ReactNode; note?: ReactNode; tone?: "primary" | "success" | "warning" | "info" | "danger"; className?: string }) {
  return (
    <div className={className}>
      <div className={`sh-tile ${tone === "primary" ? "" : `is-${tone}`}`}>
        <span className="sh-tile-label">{label}</span>
        <span className="sh-tile-value">{value}</span>
        {note && <span className="sh-tile-note">{note}</span>}
      </div>
    </div>
  );
}
