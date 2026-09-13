import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Live-system card: header with h2 title, actions floated right below it, then body. */
export function Card({ title, actions, children, className = "" }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="header">
          {title && <h2>{title}</h2>}
          {actions && <div className="pull-right">{actions}</div>}
        </div>
      )}
      <div className="body">{children}</div>
    </div>
  );
}
