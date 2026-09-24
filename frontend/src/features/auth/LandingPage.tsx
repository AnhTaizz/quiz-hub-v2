import { useState, useEffect, useCallback, useRef } from "react";
import { Navigate, Link } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { PublicHeader } from "./PublicHeader";
import heroDashboardFallback from "@/assets/images/hero/hero_dashboard.png";
import heroAnticheatFallback from "@/assets/images/hero/hero_anticheat.png";
import heroGradingFallback from "@/assets/images/hero/hero_grading.png";
import heroReportsFallback from "@/assets/images/hero/hero_reports.png";
import cover1Fallback from "@/assets/images/covers/cover1.png";
import cover2Fallback from "@/assets/images/covers/cover2.png";
import cover3Fallback from "@/assets/images/covers/cover3.png";
import "./LandingPage.css";

interface HeroSlide {
  badge: string;
  badgeClass: string;
  announce: string;
  title: React.ReactNode;
  description: string;
  primaryAction: { label: string; to: string };
  secondaryAction?: { label: string; href: string };
  image: string;
  imageFallback: string;
  imageAlt: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    badge: "MỚI",
    badgeClass: "bg-warning text-dark",
    announce: "Bảng điều khiển ra mắt",
    title: (
      <>
        Quản lý tổng quan
        <br />
        với một <span style={{ color: "#4ade80" }}>Dashboard</span>
        <br />
        thông minh
      </>
    ),
    description:
      "Tạo lớp học, xây dựng ngân hàng câu hỏi và tổ chức thi cử với hệ thống giám sát. Theo dõi tiến độ kỳ thi trực tiếp.",
    primaryAction: {
      label: "Bắt đầu ngay",
      to: "/register",
    },
    secondaryAction: {
      label: "Xem demo",
      href: "#features",
    },
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format",
    imageFallback: heroDashboardFallback,
    imageAlt: "Dashboard",
  },
  {
    badge: "BẢO MẬT",
    badgeClass: "bg-danger text-white",
    announce: "Công nghệ giám sát 24/7",
    title: (
      <>
        Hệ thống
        <br />
        <span style={{ color: "#f87171" }}>Anti-Cheat</span>
        <br />
        độc quyền
      </>
    ),
    description:
      "Phát hiện ngay lập tức các hành vi gian lận như chuyển tab, thoát toàn màn hình. Mọi vi phạm đều được ghi log theo thời gian thực.",
    primaryAction: {
      label: "Tạo bài thi an toàn",
      to: "/register",
    },
    image: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?q=80&w=1000&auto=format",
    imageFallback: heroAnticheatFallback,
    imageAlt: "Anti Cheat",
  },
  {
    badge: "TỐC ĐỘ",
    badgeClass: "bg-info text-dark",
    announce: "Kết quả trả về trong 0ms",
    title: (
      <>
        Chấm điểm
        <br />
        <span style={{ color: "#38bdf8" }}>tự động</span>
        <br />
        chính xác tuyệt đối
      </>
    ),
    description:
      "Thuật toán đối chiếu cực nhanh với đáp án. Trả điểm số cho sinh viên ngay khi hoàn thành bài thi mà không cần chờ đợi.",
    primaryAction: {
      label: "Trải nghiệm tốc độ",
      to: "/register",
    },
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1000&auto=format",
    imageFallback: heroGradingFallback,
    imageAlt: "Chấm điểm",
  },
  {
    badge: "PHÂN TÍCH",
    badgeClass: "bg-success text-white",
    announce: "Báo cáo phổ điểm",
    title: (
      <>
        Báo cáo
        <br />
        <span style={{ color: "#fcd34d" }}>Thống kê</span>
        <br />
        trực quan
      </>
    ),
    description:
      "Hệ thống tự động phân tích phổ điểm, tính toán tỷ lệ đúng sai theo từng câu hỏi và xuất báo cáo chi tiết.",
    primaryAction: {
      label: "Dùng thử ngay",
      to: "/register",
    },
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1000&auto=format",
    imageFallback: heroReportsFallback,
    imageAlt: "Báo cáo",
  },
];

export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Auto-play carousel every 4.5s
  useEffect(() => {
    if (isPaused) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [isPaused]);

  // Scroll to top visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNext = useCallback(() => {
    setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const handlePrev = useCallback(() => {
    setActiveSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  // Global arrow keys navigation for carousel (matches V1 script.js)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea") return;

      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || !e.changedTouches[0]) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  // Redirect authenticated user
  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return (
    <div className="qh-landing-v1" id="top">
      {/* =============================================
          HEADER
      ============================================== */}
      <PublicHeader variant="landing" />

      {/* =============================================
          HERO – Premium Edition (Exact 1:1 V1)
      ============================================== */}
      <section
        className="hero-section"
        id="hero"
        aria-label="Giới thiệu QuizHub"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />

        <div className="container position-relative">
          <div id="heroCarousel" className="carousel slide carousel-fade">
            {/* Indicators */}
            <div className="carousel-indicators">
              {HERO_SLIDES.map((slide, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={activeSlide === idx ? "active" : ""}
                  aria-label={`Slide ${idx + 1}: ${slide.badge}`}
                  aria-current={activeSlide === idx ? "true" : undefined}
                  onClick={() => setActiveSlide(idx)}
                />
              ))}
            </div>

            {/* Inner Slides */}
            <div className="carousel-inner">
              {HERO_SLIDES.map((slide, idx) => {
                const isActive = activeSlide === idx;
                return (
                  <div
                    key={idx}
                    className={`carousel-item ${isActive ? "active" : ""}`}
                    style={{ display: isActive ? "block" : "none" }}
                  >
                    <div className="row align-items-center g-5">
                      <div className="col-lg-6">
                        <div className="hero-content">
                          <div className="hero-announce">
                            <span className={`badge ${slide.badgeClass} me-2`}>{slide.badge}</span>{" "}
                            {slide.announce}
                          </div>
                          <h1 className="hero-title mb-4">{slide.title}</h1>
                          <p className="hero-sub mb-4">
                            {slide.description}
                          </p>
                          <div className="hero-actions d-flex gap-3">
                            <Link to={slide.primaryAction.to} className="btn-green">
                              {slide.primaryAction.label}
                            </Link>
                            {slide.secondaryAction && (
                              <a
                                href={slide.secondaryAction.href}
                                className="btn-outline-dark"
                                style={{ borderColor: "rgba(255,255,255,.3)", color: "#fff" }}
                              >
                                {slide.secondaryAction.label}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 d-none d-lg-block">
                        <div className="hero-screen shadow-lg">
                          <div
                            className="screen-bar"
                            style={{
                              background: "rgba(0,0,0,0.5)",
                              backdropFilter: "blur(8px)",
                              WebkitBackdropFilter: "blur(8px)",
                              borderBottom: "1px solid rgba(255,255,255,0.1)",
                              padding: "12px 16px",
                            }}
                          >
                            <div className="screen-dots d-flex gap-2">
                              <span
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: "#ff5f57",
                                }}
                              />
                              <span
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: "#ffbd2e",
                                }}
                              />
                              <span
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  borderRadius: "50%",
                                  background: "#28ca41",
                                }}
                              />
                            </div>
                          </div>
                          <img
                            src={slide.image}
                            className="d-block w-100"
                            style={{
                              objectPosition: idx === 0 ? "left top" : "center",
                            }}
                            alt={slide.imageAlt}
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = slide.imageFallback;
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <button
              className="carousel-control-prev custom-nav-btn"
              type="button"
              aria-label="Slide trước"
              onClick={handlePrev}
            >
              <span className="nav-icon">
                <i className="bi bi-chevron-left" />
              </span>
              <span className="visually-hidden">Previous</span>
            </button>
            <button
              className="carousel-control-next custom-nav-btn"
              type="button"
              aria-label="Slide tiếp theo"
              onClick={handleNext}
            >
              <span className="nav-icon">
                <i className="bi bi-chevron-right" />
              </span>
              <span className="visually-hidden">Next</span>
            </button>
          </div>
        </div>
      </section>

      <main id="main">
        {/* =============================================
            TRUSTED BY (Exact 1:1 V1)
        ============================================== */}
        <section className="logos-section">
          <div className="container">
            <h6>Được tin dùng tại các trường đại học và trung tâm đào tạo</h6>
            <div className="logos-row">
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> PTIT
              </div>
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> HUST
              </div>
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> VNU-UET
              </div>
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> FPT Edu
              </div>
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> NEU
              </div>
              <div className="logo-badge">
                <i className="bi bi-mortarboard-fill" /> HCMUTE
              </div>
            </div>
          </div>
        </section>

        {/* =============================================
            FEATURES (Exact 1:1 V1 - 6 Cards)
        ============================================== */}
        <section id="features" className="features-section">
          <div className="container">
            <div className="section-head reveal visible">
              <div className="section-label">Tính năng nổi bật</div>
              <h2>
                Kiểm tra <span>Dịch vụ</span> của chúng tôi
              </h2>
              <p>Được thiết kế phục vụ sát nhất với nhu cầu thực tế của các cơ sở giáo dục hiện đại</p>
            </div>

            <div className="row g-4">
              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible">
                  <div className="feat-icon">
                    <i className="bi bi-diagram-3-fill" />
                  </div>
                  <h4>Quản lý Lớp học</h4>
                  <p>
                    Giáo viên khởi tạo không gian lớp học ảo. Sinh viên tham gia qua mã Class Code
                    do giảng viên cấp – đơn giản, nhanh chóng.
                  </p>
                </div>
              </div>

              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible" style={{ transitionDelay: ".08s" }}>
                  <div
                    className="feat-icon"
                    style={{ background: "#2563eb", boxShadow: "0 6px 20px rgba(37, 99, 235, .3)" }}
                  >
                    <i className="bi bi-collection-fill" />
                  </div>
                  <h4>Ngân hàng Câu hỏi</h4>
                  <p>
                    Xây dựng kho câu hỏi theo cấu trúc cây danh mục. Hỗ trợ nhiều loại câu hỏi, dễ
                    dàng truy xuất để tạo đề thi.
                  </p>
                </div>
              </div>

              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible" style={{ transitionDelay: ".16s" }}>
                  <div
                    className="feat-icon"
                    style={{ background: "#e11d48", boxShadow: "0 6px 20px rgba(225, 29, 72, .3)" }}
                  >
                    <i className="bi bi-shield-exclamation" />
                  </div>
                  <h4>Hệ thống Anti-Cheat</h4>
                  <p>
                    Theo dõi sự kiện trình duyệt real-time. Cảnh báo và lưu vào database mọi hành vi
                    bất thường (TAB_SWITCH, ESC_FULLSCREEN…).
                  </p>
                </div>
              </div>

              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible" style={{ transitionDelay: ".08s" }}>
                  <div
                    className="feat-icon"
                    style={{ background: "#fd7e14", boxShadow: "0 6px 20px rgba(253, 126, 20, .3)" }}
                  >
                    <i className="bi bi-stopwatch-fill" />
                  </div>
                  <h4>Giao bài &amp; Đếm ngược</h4>
                  <p>
                    Thiết lập thời gian làm bài và hạn nộp. Phòng thi đếm ngược an toàn, tự động khóa
                    bài khi hết giờ.
                  </p>
                </div>
              </div>

              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible" style={{ transitionDelay: ".16s" }}>
                  <div
                    className="feat-icon"
                    style={{ background: "#17a2b8", boxShadow: "0 6px 20px rgba(23, 162, 184, .3)" }}
                  >
                    <i className="bi bi-cloud-check-fill" />
                  </div>
                  <h4>Lưu Nháp Tự Động</h4>
                  <p>
                    Sinh viên không lo rớt mạng. Đáp án được lưu nháp liên tục, đảm bảo khôi phục
                    100% dữ liệu khi trình duyệt được mở lại.
                  </p>
                </div>
              </div>

              <div className="col-lg-4 col-md-6">
                <div className="feat-card reveal visible" style={{ transitionDelay: ".24s" }}>
                  <div
                    className="feat-icon"
                    style={{ background: "#7c3aed", boxShadow: "0 6px 20px rgba(124, 58, 237, .3)" }}
                  >
                    <i className="bi bi-bar-chart-line-fill" />
                  </div>
                  <h4>Chấm Điểm Real-time</h4>
                  <p>
                    Thuật toán đối chiếu đáp án siêu tốc. Trả về kết quả, số câu đúng/sai và điểm số
                    ngay lập tức sau khi nộp bài.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =============================================
            ABOUT (Exact 1:1 V1 - WHO WE ARE)
        ============================================== */}
        <section id="about" className="about-section">
          <div className="container">
            <div className="row align-items-center g-5">
              <div className="col-lg-6 reveal visible">
                <div className="about-imgs">
                  <img
                    className="about-img-main"
                    src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format"
                    alt="Nhóm làm việc quizHub"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = cover1Fallback;
                    }}
                  />
                  <img
                    className="about-img-sm1"
                    src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=400&auto=format"
                    alt="Sinh viên làm bài thi"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = cover2Fallback;
                    }}
                  />
                  <img
                    className="about-img-sm2"
                    src="https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=400&auto=format"
                    alt="Giáo viên kiểm tra kết quả"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = cover3Fallback;
                    }}
                  />
                </div>
              </div>

              <div className="col-lg-6">
                <div className="about-text reveal visible">
                  <div className="section-label">Về chúng tôi</div>
                  <h2>
                    Giải quyết triệt để bài toán
                    <br />
                    thi cử trực tuyến
                  </h2>
                  <p>
                    Việc tổ chức thi trắc nghiệm truyền thống tốn kém thời gian chấm điểm và khó
                    kiểm soát. <strong>QuizHub</strong> được xây dựng với nền tảng Backend mạnh mẽ
                    (Java Spring Boot, Spring Data JPA, JWT Security), mang lại khả năng xử lý
                    đồng thời lượng lớn sinh viên mà vẫn đảm bảo tính toàn vẹn dữ liệu.
                  </p>

                  <ul className="check-list">
                    <li>
                      <span className="ci">
                        <i className="bi bi-check-lg" />
                      </span>
                      Tách biệt phân quyền chặt chẽ (Role: TEACHER &amp; STUDENT)
                    </li>
                    <li>
                      <span className="ci">
                        <i className="bi bi-check-lg" />
                      </span>
                      Cơ chế Auto-save lưu trạng thái bài thi theo từng cú click chuột
                    </li>
                    <li>
                      <span className="ci">
                        <i className="bi bi-check-lg" />
                      </span>
                      RESTful API chuẩn xác, dễ dàng tích hợp và mở rộng hệ thống
                    </li>
                    <li>
                      <span className="ci">
                        <i className="bi bi-check-lg" />
                      </span>
                      Anti-cheat engine ghi log vi phạm real-time vào database
                    </li>
                  </ul>

                  <Link to="/register" className="btn-green">
                    <i className="bi bi-rocket-takeoff-fill" /> Bắt đầu ngay hôm nay
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =============================================
            WORKFLOW / STEPS (Exact 1:1 V1 - 3 Steps)
        ============================================== */}
        <section id="workflow" className="workflow-section">
          <div className="container">
            <div className="section-head reveal visible">
              <div className="section-label">Quy trình vận hành</div>
              <h2>
                Đơn giản như <span>1, 2, 3</span>
              </h2>
              <p>Trải nghiệm người dùng mượt mà qua 3 bước cốt lõi, không cần hướng dẫn phức tạp</p>
            </div>

            <div className="steps-row reveal visible">
              <div className="step-card">
                <div className="step-num">1</div>
                <h4>Khởi tạo</h4>
                <p>
                  Giáo viên tạo Lớp học (Classroom) và nạp câu hỏi vào Ngân hàng dữ liệu phân loại
                  theo môn học và chủ đề.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num">2</div>
                <h4>Giao bài</h4>
                <p>
                  Tạo Bài kiểm tra (Quiz), cấu hình thời gian làm bài, bật chế độ chống gian lận và
                  Assign cho lớp học mục tiêu.
                </p>
              </div>

              <div className="step-card">
                <div className="step-num">3</div>
                <h4>Thu hoạch</h4>
                <p>
                  Sinh viên làm bài trên giao diện an toàn. Hệ thống tự động thu bài, chấm điểm và
                  báo cáo vi phạm tức thì.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =============================================
            CTA BANNER (Exact 1:1 V1)
        ============================================== */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-inner reveal visible">
              <h2>Số hóa ngay hôm nay với quizHub</h2>
              <p>
                Nền tảng kiểm tra và đánh giá năng lực đáng tin cậy. Dễ dàng triển khai, tối ưu hiệu
                suất.
              </p>

              <Link to="/register" className="btn-cta-white">
                <i className="bi bi-rocket-takeoff-fill" /> Tạo tài khoản miễn phí
              </Link>

              <div className="cta-perks">
                <div className="cta-perk">
                  <i className="bi bi-check-circle-fill" /> Không cần thẻ tín dụng
                </div>
                <div className="cta-perk">
                  <i className="bi bi-check-circle-fill" /> Hoàn toàn miễn phí
                </div>
                <div className="cta-perk">
                  <i className="bi bi-check-circle-fill" /> Hỗ trợ 24/7
                </div>
                <div className="cta-perk">
                  <i className="bi bi-check-circle-fill" /> Bảo mật tuyệt đối
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =============================================
          FOOTER (Exact 1:1 V1 - 4 Columns)
      ============================================== */}
      <footer id="footer">
        <div className="container">
          <div className="row g-4 mb-3">
            <div className="col-lg-4 col-md-6">
              <div className="footer-logo">
                quizHub<span>.</span>
              </div>
              <p className="footer-desc">
                Hệ thống thi trắc nghiệm trực tuyến mã nguồn mở. Cung cấp bộ API mạnh mẽ với Spring
                Boot và giao diện hiện đại, tối ưu cho môi trường giáo dục Việt Nam.
              </p>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <div className="footer-col-title">Tính năng</div>
              <ul className="footer-links">
                <li>
                  <a href="#features">
                    <i className="bi bi-chevron-right" /> Quản lý Lớp học
                  </a>
                </li>
                <li>
                  <a href="#features">
                    <i className="bi bi-chevron-right" /> Ngân hàng Câu hỏi
                  </a>
                </li>
                <li>
                  <a href="#features">
                    <i className="bi bi-chevron-right" /> Anti-cheat
                  </a>
                </li>
                <li>
                  <a href="#features">
                    <i className="bi bi-chevron-right" /> Báo cáo &amp; Thống kê
                  </a>
                </li>
              </ul>
            </div>

            <div className="col-lg-2 col-md-3 col-6">
              <div className="footer-col-title">Tài nguyên</div>
              <ul className="footer-links">
                <li>
                  <a href="#features">
                    <i className="bi bi-chevron-right" /> Tài liệu API
                  </a>
                </li>
                <li>
                  <a href="#workflow">
                    <i className="bi bi-chevron-right" /> Hướng dẫn sử dụng
                  </a>
                </li>
                <li>
                  <a href="#about">
                    <i className="bi bi-chevron-right" /> Quy chế hoạt động
                  </a>
                </li>
                <li>
                  <a href="#about">
                    <i className="bi bi-chevron-right" /> Câu hỏi thường gặp
                  </a>
                </li>
              </ul>
            </div>

            <div className="col-lg-4 col-md-12">
              <div className="footer-col-title">Liên hệ</div>
              <div className="footer-contact">
                <p>
                  <i className="bi bi-geo-alt-fill" /> Học viện Công nghệ Bưu chính Viễn thông, Hà
                  Đông, Hà Nội
                </p>
                <p>
                  <i className="bi bi-envelope-fill" /> support@quizhub.edu.vn
                </p>
                <p>
                  <i className="bi bi-telephone-fill" /> +84 28 3838 0000
                </p>
              </div>
            </div>
          </div>

          <hr className="footer-hr" />

          <div className="footer-bottom">
            <div className="footer-copy">
              &copy; 2026 <strong>quizHub Platform</strong>. Phát triển bởi Sinh viên CNTT.
            </div>
            <div className="footer-socials">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub Repository"
              >
                <i className="bi bi-github" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <i className="bi bi-facebook" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
                <i className="bi bi-youtube" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      <div
        id="scrolltop"
        className="position-fixed bottom-0 end-0 p-3"
        style={{ display: showScrollTop ? "block" : "none" }}
      >
        <a
          href="#top"
          aria-label="Cuộn lên đầu trang"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <i className="bi bi-chevron-up" />
        </a>
      </div>
    </div>
  );
}
