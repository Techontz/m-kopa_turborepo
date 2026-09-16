"use client";

/**
 * The one loader of the app: a small card in the middle of the screen over a dimmed page, the same card and backdrop as the
 * modals ({@see Modal}). Use it whenever a page or a section has nothing to show yet; rows inside a table keep their inline
 * message so the table's own header and layout stay put.
 */
export function Loading({ message = "Loading...", inline = false }: { message?: string; inline?: boolean }) {
  if (inline) {
    return <div className="mf-loading">{message}</div>;
  }

  return (
    <>
      <div className="mf-modal-backdrop mf-loading-backdrop" />
      <div className="mf-loading-popup" role="status" aria-live="polite">
        <div className="mf-loading-card">
          <span className="mf-loading-spinner" aria-hidden="true" />
          <span className="mf-loading-text">{message}</span>
        </div>
      </div>
    </>
  );
}
