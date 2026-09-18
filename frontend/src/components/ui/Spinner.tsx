import "./Spinner.css";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span className="qh-spinner-wrap" role="status">
      <span className="qh-spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}
