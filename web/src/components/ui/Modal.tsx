"use client";

import { useEffect, type FormEvent, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** When set, the body is wrapped in a form and a primary submit button is shown. */
  submitLabel?: string;
  onSubmit?: () => void;
  submitting?: boolean;
  size?: "sm" | "lg" | "xl";
}

/** Bootstrap-styled modal (live system look) with Filter/Save + CLOSE footer. */
export function Modal({ open, onClose, title, children, submitLabel, onSubmit, submitting, size }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const content = (
    <>
      {title && (
        <div className="modal-header">
          <h6 className="title">{title}</h6>
        </div>
      )}
      <div className="modal-body">{children}</div>
      <div className="modal-footer">
        {submitLabel && (
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Please wait..." : submitLabel}
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onClose}>CLOSE</button>
      </div>
    </>
  );

  return (
    <>
      <div className="mf-modal-backdrop" onClick={onClose} />
      <div className="mf-modal" role="dialog" onClick={onClose}>
        <div className={`modal-dialog ${size ? `modal-${size}` : ""}`} onClick={(event) => event.stopPropagation()}>
          <div className="modal-content">
            {submitLabel ? (
              <form
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  onSubmit?.();
                }}
              >
                {content}
              </form>
            ) : (
              content
            )}
          </div>
        </div>
      </div>
    </>
  );
}
