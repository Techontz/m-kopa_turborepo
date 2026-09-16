"use client";

/**
 * The one loader of the app: the same white card the live system's dialogs use (SweetAlert 2 — 478px, 5px radius, 27px
 * title) over the same dimmed overlay, with a spinner in place of the icon. `app/(app)/loading.tsx` shows it between pages.
 *
 * `inline` keeps a one-line message for rows inside a table, where covering the screen would hide the very columns being
 * loaded.
 */
export function Loading({ message = "Please wait...", inline = false }: { message?: string; inline?: boolean }) {
  if (inline) {
    return <div className="mf-loading">{message}</div>;
  }

  return (
    <div className="mf-loading-overlay" role="status" aria-live="polite">
      <div className="mf-loading-card">
        <span className="mf-loading-spinner" aria-hidden="true" />
        <span className="mf-loading-title">{message}</span>
      </div>
    </div>
  );
}
