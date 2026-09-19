import "./SaveIndicator.css";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Subtle per-question autosave state: never a toast per save, but a failure is persistent and offers a retry. */
export function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "saving") return <span className="qh-save-indicator qh-save-indicator--saving">Saving…</span>;
  if (status === "saved") return <span className="qh-save-indicator qh-save-indicator--saved">Saved</span>;
  if (status === "error") {
    return (
      <span className="qh-save-indicator qh-save-indicator--error" role="alert">
        Save failed - answer kept on this device.{" "}
        <button type="button" className="qh-save-indicator__retry" onClick={onRetry}>
          Retry
        </button>
      </span>
    );
  }
  return null;
}
