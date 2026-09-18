import type { ReactNode } from "react";
import "./PageHeader.css";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="qh-page-header">
      <div>
        <h1 className="qh-page-header__title">{title}</h1>
        {description && <p className="qh-page-header__description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
