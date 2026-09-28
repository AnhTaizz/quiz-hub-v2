import "./Spinner.css";

export function Spinner({ label = "Đang tải..." }: { label?: string }) {
  return (
    <span className="qh-spinner-wrap" role="status">
      <span className="qh-spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
