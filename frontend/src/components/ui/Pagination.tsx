import { Button } from "./Button";
import "./Pagination.css";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number; // 0-indexed, matches Spring's Page<T>.number
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="qh-pagination" aria-label="Pagination">
      <Button
        variant="secondary"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 0}
      >
        Previous
      </Button>
      <span className="qh-pagination__status">
        Page {page + 1} of {totalPages}
      </span>
      <Button
        variant="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
      >
        Next
      </Button>
    </nav>
  );
}
