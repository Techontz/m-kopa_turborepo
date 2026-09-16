import type { ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}

/** Form cell: label above the control, error below. Spacing, label style and control height come from polish.css. */
export function Field({ label, error, children, className = "col-lg-4 col-md-6", required }: FieldProps) {
  return (
    <div className={`${className} mf-field`}>
      <span className="mf-label">
        {label}
        {required && <span className="mf-required">*</span>}
      </span>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
