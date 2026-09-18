import type { ReactNode } from "react";
import "./Badge.css";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`qh-badge qh-badge--${tone}`}>{children}</span>;
}
