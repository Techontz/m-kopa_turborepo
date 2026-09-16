"use client";

/**
 * The loader of the live system: its own spinner (a ring with two #0dc5c1 halves sweeping round) inside the same white card
 * its dialogs use, over the same dimmed overlay. `app/(app)/loading.tsx` shows it between pages.
 *
 * `inline` drops the card and the overlay and puts the spinner in the rows of a table, where covering the screen would hide
 * the very columns being loaded.
 */
export function Loading({ message = "Please wait...", inline = false }: { message?: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="mf-loading">
        <span className="mf-loader">{message}</span>
      </div>
    );
  }

  return (
    <div className="mf-loading-overlay" role="status" aria-live="polite">
      <div className="mf-loading-card">
        <span className="mf-loader">{message}</span>
        <span className="mf-loading-title">{message}</span>
      </div>
    </div>
  );
}
