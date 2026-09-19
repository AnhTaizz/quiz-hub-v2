import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { initials } from "@/features/profile/profileValidation";
import "./AppShell.css";

const NAV_ITEMS = [
  { to: "/student", label: "Dashboard", end: true },
  { to: "/student/quizzes", label: "Quizzes" },
  { to: "/student/classrooms", label: "Classrooms" },
  { to: "/student/practice", label: "Practice" },
  { to: "/student/history", label: "History" },
  { to: "/profile", label: "Profile" },
];

// Student pages not yet migrated to React (Sprint 1 scope). These are still
// server-rendered Thymeleaf pages, so they are plain full-page links (<a>),
// deliberately not client-side <NavLink>s.
const LEGACY_NAV_ITEMS = [
  { href: "/student/categories?type=mine", label: "My library" },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="qh-shell">
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
        <span className="qh-shell__brand">
          Quiz<span className="qh-shell__brand-hub">Hub</span>
        </span>

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
          <NotificationBell />
          <span className="qh-shell__avatar" aria-hidden="true">
            {initials(user?.fullName ?? "")}
          </span>
          <span className="qh-shell__username">{user?.fullName}</span>
          <button type="button" className="qh-shell__logout" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="qh-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
