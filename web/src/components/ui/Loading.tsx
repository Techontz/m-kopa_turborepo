"use client";

/**
 * The loader of the live system: its own spinner — a ring with two #0dc5c1 halves sweeping round — and nothing else: no
 * card, no backdrop, no wait text. `app/(app)/loading.tsx` shows it between pages; `inline` puts it in the rows of a table.
 *
 * The message is read by screen readers only (the spinner rule hides the text with an indent).
 */
export function Loading({ message = "Loading", inline = false }: { message?: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="mf-loading">
        <span className="mf-loader" role="status">{message}</span>
      </div>
    );
  }

  return (
    <div className="mf-loading-overlay">
      <span className="mf-loader" role="status">{message}</span>
    </div>
  );
}
