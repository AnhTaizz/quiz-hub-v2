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
    <nav className="qh-pagination" aria-label="Phân trang">
      <Button
        variant="secondary"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 0}
      >
        Trang trước
      </Button>
      <span className="qh-pagination__status">
        Trang {page + 1} / {totalPages}
      </span>
      <Button
        variant="secondary"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages - 1}
      >
        Trang sau
      </Button>
    </nav>
  );
}
