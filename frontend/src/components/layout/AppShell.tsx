import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { initials } from "@/features/profile/profileValidation";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/student", label: "Trang chủ", end: true },
  { to: "/student/quizzes", label: "Bài thi của tôi" },
  { to: "/student/classrooms", label: "Lớp học" },
  { to: "/student/history", label: "Lịch sử làm bài" },
  { to: "/student/practice", label: "Luyện tập" },
];

// Student pages not yet migrated to React (Sprint 1 scope). These are still
// server-rendered Thymeleaf pages, so they are plain full-page links (<a>),
// deliberately not client-side <NavLink>s.
const LEGACY_NAV_ITEMS = [
  { href: "/student/categories?type=mine", label: "Thư viện của tôi" },
];

export function StudentHeader() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="qh-shell__header">
        <button
          type="button"
          className="qh-shell__menu-toggle"
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen((v) => !v)}
        >
          <span aria-hidden="true">☰</span>
        </button>
      <Link to="/student" className="qh-shell__brand">
          <svg className="qh-shell__brand-icon" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M12 2 2 7l10 5 10-5-10-5Zm-8.2 8.2L2 11l10 5 10-5-1.8-.8L12 14.3 3.8 10.2Zm0 4L2 15l10 5 10-5-1.8-.8L12 18.3l-8.2-4.1Z" />
          </svg>
          Quiz<span className="qh-shell__brand-hub">Hub</span>
      </Link>

        <nav
          className={`qh-shell__nav ${drawerOpen ? "qh-shell__nav--open" : ""}`}
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `qh-shell__nav-link ${isActive ? "qh-shell__nav-link--active" : ""}`}
              onClick={() => setDrawerOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          {LEGACY_NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="qh-shell__nav-link">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="qh-shell__user">
          <a className="qh-shell__join" href="/student/classrooms#join-classroom">
            <i className="bi bi-plus-lg" aria-hidden="true" /> Nhập mã lớp
          </a>
          <NotificationBell />
          <details className="qh-shell__account">
            <summary>
              <span className="qh-shell__identity">
                <strong>{user?.fullName}</strong>
                <small>Sinh viên</small>
              </span>
              {user?.avatarUrl ? (
                <img className="qh-shell__avatar" src={user.avatarUrl} alt="" />
              ) : (
                <span className="qh-shell__avatar" aria-hidden="true">
                  {initials(user?.fullName ?? "")}
                </span>
              )}
            </summary>
            <div className="qh-shell__account-menu">
              <NavLink to="/profile"><i className="bi bi-person" /> Hồ sơ cá nhân</NavLink>
              <NavLink to="/profile"><i className="bi bi-key" /> Đổi mật khẩu</NavLink>
              <button type="button" onClick={logout}><i className="bi bi-box-arrow-right" /> Đăng xuất</button>
            </div>
          </details>
        </div>
    </header>
  );
}

export function AppShell() {
  return (
    <div className="qh-shell">
      <StudentHeader />

      <main className="qh-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
