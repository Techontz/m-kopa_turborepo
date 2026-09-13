import type { ReactNode } from "react";

interface FieldProps {
  label: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}

/** Live form cell: "<span>Label:</span>" above the control, error below. */
export function Field({ label, error, children, className = "col-lg-4 col-md-6", required }: FieldProps) {
  return (
    <div className={`${className} mb-2`}>
      <span>
        {required ? "*" : ""}
        {label}
      </span>
      {children}
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
