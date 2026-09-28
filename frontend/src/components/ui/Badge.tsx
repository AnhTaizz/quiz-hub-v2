import type { ReactNode } from "react";
import "./Badge.css";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return <span className={`qh-badge qh-badge--${tone} ${className}`.trim()}>{children}</span>;
}
