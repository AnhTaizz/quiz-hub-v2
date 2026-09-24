import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import "./PublicHeader.css";

export interface PublicHeaderProps {
  variant?: "landing" | "auth";
}

export function PublicHeader({ variant }: PublicHeaderProps) {
  const location = useLocation();
  const isLanding = variant === "landing" || (!variant && location.pathname === "/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

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

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    closeMobile();
    if (!isLanding) return;
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
  };

  if (!isLanding) {
    return (
      <header className="qh-public-header">
        <Link to="/" className="qh-public-brand" aria-label="QuizHub - Trang chủ">
          <i className="bi bi-layers-fill" />
          <span>
            quiz<span>Hub</span>
            <span className="qh-public-brand__dot">.</span>
          </span>
        </Link>

        <nav className="qh-public-nav-desktop" aria-label="Điều hướng chính">
          <a href="/#features">Tính năng</a>
          <a href="/#about">Giới thiệu</a>
          <a href="/#workflow">Quy trình</a>
          <Link to="/login" className="qh-public-nav-link--login">
            Đăng nhập
          </Link>
          <Link to="/register" className="qh-public-header__cta">
            Bắt đầu miễn phí
          </Link>
        </nav>

        <button
          type="button"
          className="qh-public-header__toggle"
          aria-label={mobileOpen ? "Đóng menu" : "Mở menu điều hướng"}
          aria-expanded={mobileOpen}
          aria-controls="qh-public-drawer"
          onClick={() => setMobileOpen((prev) => !prev)}
        >
          <i className={`bi ${mobileOpen ? "bi-x-lg" : "bi-list"}`} />
        </button>

        {mobileOpen && (
          <div className="qh-public-drawer-backdrop" onClick={closeMobile} aria-hidden="true" />
        )}
        <div
          id="qh-public-drawer"
          className={`qh-public-drawer ${mobileOpen ? "is-open" : ""}`}
          aria-label="Menu trên di động"
          aria-hidden={!mobileOpen}
        >
          <nav className="qh-public-drawer__nav" aria-label="Điều hướng di động">
            <a href="/#features" onClick={closeMobile}>
              <i className="bi bi-grid-fill" /> Tính năng
            </a>
            <a href="/#about" onClick={closeMobile}>
              <i className="bi bi-info-circle-fill" /> Giới thiệu
            </a>
            <a href="/#workflow" onClick={closeMobile}>
              <i className="bi bi-diagram-3-fill" /> Quy trình
            </a>
            <hr className="qh-public-drawer__divider" />
            <Link to="/login" onClick={closeMobile} className="qh-public-drawer__link">
              <i className="bi bi-box-arrow-in-right" /> Đăng nhập
            </Link>
            <Link to="/register" onClick={closeMobile} className="qh-public-drawer__cta">
              <i className="bi bi-rocket-takeoff-fill" /> Bắt đầu miễn phí
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  // Exact 1:1 V1 Header
  return (
    <header id="header" className={`fixed-top ${scrolled ? "header-scrolled" : ""}`}>
      <div className="container d-flex align-items-center justify-content-between">
        <h1 className="logo mb-0">
          <Link to="/" aria-label="QuizHub - Trang chủ">
            <i className="bi bi-layers-fill logo-icon" />
            Quiz<span className="hub">Hub</span>
          </Link>
        </h1>

        <nav id="navbar" className="navbar" aria-label="Điều hướng chính">
          <ul id="nav-menu" className={mobileOpen ? "nav-open" : ""}>
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "about" ? "active" : ""}`}
                href="#about"
                onClick={(e) => handleSmoothScroll(e, "#about")}
              >
                Về chúng tôi
              </a>
            </li>
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "features" ? "active" : ""}`}
                href="#features"
                onClick={(e) => handleSmoothScroll(e, "#features")}
              >
                Tính năng
              </a>
            </li>
            <li>
              <a
                className={`nav-link scrollto ${activeSection === "workflow" ? "active" : ""}`}
                href="#workflow"
                onClick={(e) => handleSmoothScroll(e, "#workflow")}
              >
                Quy trình
              </a>
            </li>
            <li className="ms-lg-3">
              <Link to="/login" className="nav-btn-login" onClick={closeMobile}>
                Đăng nhập
              </Link>
            </li>
            <li>
              <Link to="/register" className="nav-btn-signup" onClick={closeMobile}>
                Dùng miễn phí
              </Link>
            </li>
          </ul>
          <button
            type="button"
            className="mobile-nav-toggle"
            id="mobile-nav-toggle"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu điều hướng"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            <i className={`bi ${mobileOpen ? "bi-x" : "bi-list"}`} />
            <span className="visually-hidden">
              {mobileOpen ? "Đóng menu" : "Mở menu điều hướng"}
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
}
