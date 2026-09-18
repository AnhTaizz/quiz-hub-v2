import type { ReactNode } from "react";
import "./States.css";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="qh-state qh-state--empty">
      <p className="qh-state__title">{title}</p>
      {description && <p className="qh-state__description">{description}</p>}
      {action}
    </div>
  );
}
