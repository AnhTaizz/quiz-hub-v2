import { Link } from "react-router";
import "./PublicHeader.css";

export function PublicHeader() {
  return (
    <header className="qh-public-header">
      <Link to="/" className="qh-public-brand" aria-label="QuizHub - Trang chủ">
        <i className="bi bi-layers-fill" />
        <span>Quiz<span>Hub</span></span>
      </Link>
      <nav aria-label="Điều hướng chính">
        <a href="/#features">Tính năng</a>
        <a href="/#how-it-works">Cách hoạt động</a>
        <Link to="/login">Đăng nhập</Link>
        <Link to="/register" className="qh-public-header__cta">Bắt đầu miễn phí</Link>
      </nav>
    </header>
  );
}
