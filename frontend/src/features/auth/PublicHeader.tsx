import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";
import "./PublicHeader.css";

export interface PublicHeaderProps {
  variant?: "landing" | "auth";
}

export function PublicHeader({ variant }: PublicHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = variant === "landing" || (!variant && location.pathname === "/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
  const navMenuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!isLanding) return;
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);

      const sections = ["about", "features", "workflow"];
      const headerEl = document.getElementById("header");
      const offset = headerEl ? headerEl.offsetHeight + 60 : 128;
      const scrollPos = window.scrollY + offset;

      for (let i = sections.length - 1; i >= 0; i--) {
        const secId = sections[i];
        if (secId) {
          const sec = document.getElementById(secId);
          if (sec && scrollPos >= sec.offsetTop) {
            setActiveSection(secId);
            return;
          }
        }
      }
      setActiveSection("");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isLanding]);

  const closeMobile = (returnFocus = true) => {
    setMobileOpen(false);
    if (returnFocus) {
      toggleBtnRef.current?.focus();
    }
  };

  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeMobile(true);
        return;
      }

      if (e.key === "Tab") {
        const navEl = navMenuRef.current;
        const toggleBtn = toggleBtnRef.current;
        if (!navEl || !toggleBtn) return;

        const focusable = [
          toggleBtn,
          ...Array.from(navEl.querySelectorAll<HTMLElement>("a, button, [tabindex]:not([tabindex='-1'])")),
        ];

        if (focusable.length === 0) return;

        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl?.focus();
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl?.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    closeMobile(false);
    if (isLanding) {
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      const headerEl = document.getElementById("header");
      const offset = headerEl ? headerEl.offsetHeight : 68;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = target.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    } else {
      e.preventDefault();
      navigate("/" + hash);
    }
  };

  return (
    <header id="header" className={`fixed-top ${scrolled ? "header-scrolled" : ""}`}>
      <div className="container d-flex align-items-center justify-content-between">
        <h1 className="logo mb-0">
          <Link to="/" aria-label="QuizHub - Trang chủ" onClick={() => closeMobile(false)}>
            <i className="bi bi-layers-fill logo-icon" />
            Quiz<span className="hub">Hub</span>
          </Link>
        </h1>

        <nav id="navbar" className="navbar" aria-label="Điều hướng chính">
          <ul
            id="nav-menu"
            ref={navMenuRef}
            className={mobileOpen ? "nav-open" : ""}
            aria-hidden={!mobileOpen ? undefined : false}
          >
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "about" ? "active" : ""}`}
                href="/#about"
                onClick={(e) => handleNavClick(e, "#about")}
              >
                Về chúng tôi
              </a>
            </li>
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "features" ? "active" : ""}`}
                href="/#features"
                onClick={(e) => handleNavClick(e, "#features")}
              >
                Tính năng
              </a>
            </li>
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "workflow" ? "active" : ""}`}
                href="/#workflow"
                onClick={(e) => handleNavClick(e, "#workflow")}
              >
                Quy trình
              </a>
            </li>
            <li className="ms-lg-3">
              <Link
                to="/login"
                className={`nav-btn-login ${location.pathname === "/login" ? "active" : ""}`}
                onClick={() => closeMobile(false)}
              >
                Đăng nhập
              </Link>
            </li>
            <li>
              <Link
                to="/register"
                className="nav-btn-signup"
                onClick={() => closeMobile(false)}
              >
                Dùng miễn phí
              </Link>
            </li>
          </ul>

          <button
            ref={toggleBtnRef}
            type="button"
            className="mobile-nav-toggle"
            id="mobile-nav-toggle"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu điều hướng"}
            aria-expanded={mobileOpen}
            aria-controls="nav-menu"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            <i className={`bi ${mobileOpen ? "bi-x" : "bi-list"}`} />
            <span className="visually-hidden">
              {mobileOpen ? "Đóng menu" : "Mở menu điều hướng"}
            </span>
          </button>
        </nav>
      </div>

      {mobileOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="mobile-nav-backdrop"
            onClick={() => closeMobile(true)}
            aria-hidden="true"
          />,
          document.body,
        )}
    </header>
  );
}

