import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LandingPage } from "./LandingPage";
import { AuthProvider } from "@/auth/AuthProvider";
import { clearSession, setSession, type StoredUser } from "@/auth/authStorage";

function renderLanding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/teacher" element={<div>Teacher Dashboard</div>} />
            <Route path="/student" element={<div>Student Dashboard</div>} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/register" element={<div>Register Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LandingPage Component - V1 1:1 Parity", () => {
  beforeEach(() => {
    clearSession();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    clearSession();
  });

  it("renders all core landing page sections with exact V1 content and structure", () => {
    renderLanding();

    // 1. Header (V1 style)
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /QuizHub/i })).toBeInTheDocument();
    expect(screen.getAllByText("Về chúng tôi").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tính năng").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Quy trình").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Đăng nhập")).toBeInTheDocument();
    expect(screen.getByText("Dùng miễn phí")).toBeInTheDocument();

    // 2. Hero Section (Slide 1 by default)
    expect(screen.getByText("MỚI")).toBeInTheDocument();
    expect(screen.getByText("Bảng điều khiển ra mắt")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /Quản lý tổng quan/i })).toBeInTheDocument();
    expect(screen.getByText("Bắt đầu ngay")).toBeInTheDocument();
    expect(screen.getByText("Xem demo")).toBeInTheDocument();

    // 3. Logos Section (6 university badges)
    expect(
      screen.getByText("Được tin dùng tại các trường đại học và trung tâm đào tạo"),
    ).toBeInTheDocument();
    expect(screen.getByText(/PTIT/i)).toBeInTheDocument();
    expect(screen.getByText(/HUST/i)).toBeInTheDocument();
    expect(screen.getByText(/VNU-UET/i)).toBeInTheDocument();
    expect(screen.getByText(/FPT Edu/i)).toBeInTheDocument();
    expect(screen.getByText(/NEU/i)).toBeInTheDocument();
    expect(screen.getByText(/HCMUTE/i)).toBeInTheDocument();

    // 4. Features Section (6 cards)
    expect(screen.getByText("Tính năng nổi bật")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Kiểm tra/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Quản lý Lớp học" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Ngân hàng Câu hỏi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Hệ thống Anti-Cheat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Giao bài & Đếm ngược" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Lưu Nháp Tự Động" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Chấm Điểm Real-time" })).toBeInTheDocument();

    // 5. About Section
    expect(screen.getAllByText("Về chúng tôi").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Giải quyết triệt để bài toán/i)).toBeInTheDocument();
    expect(screen.getByText(/thi cử trực tuyến/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tách biệt phân quyền chặt chẽ \(Role: TEACHER & STUDENT\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cơ chế Auto-save lưu trạng thái bài thi theo từng cú click chuột/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/RESTful API chuẩn xác, dễ dàng tích hợp và mở rộng hệ thống/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Anti-cheat engine ghi log vi phạm real-time vào database/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Bắt đầu ngay hôm nay/i)).toBeInTheDocument();

    // 6. Workflow Section (3 steps)
    expect(screen.getByText("Quy trình vận hành")).toBeInTheDocument();
    expect(screen.getByText(/Đơn giản như/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Khởi tạo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Giao bài" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Thu hoạch" })).toBeInTheDocument();

    // 7. CTA Section
    expect(
      screen.getByRole("heading", { level: 2, name: /Số hóa ngay hôm nay với quizHub/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tạo tài khoản miễn phí")).toBeInTheDocument();
    expect(screen.getByText("Không cần thẻ tín dụng")).toBeInTheDocument();
    expect(screen.getByText("Hoàn toàn miễn phí")).toBeInTheDocument();
    expect(screen.getByText("Hỗ trợ 24/7")).toBeInTheDocument();
    expect(screen.getByText("Bảo mật tuyệt đối")).toBeInTheDocument();

    // 8. Footer (4 columns)
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(document.querySelector(".footer-logo")).toHaveTextContent("quizHub.");
    expect(
      screen.getByText(/Học viện Công nghệ Bưu chính Viễn thông, Hà Đông, Hà Nội/i),
    ).toBeInTheDocument();
    expect(screen.getByText("support@quizhub.edu.vn")).toBeInTheDocument();
    expect(screen.getByLabelText(/GitHub Repository/i)).toBeInTheDocument();

    // 9. Scroll to Top button
    expect(screen.getByLabelText(/Cuộn lên đầu trang/i)).toBeInTheDocument();
  });

  it("navigates hero slides with Next and Prev controls across all 4 slides", () => {
    renderLanding();

    // Starts at Slide 1
    expect(screen.getByText("MỚI")).toBeInTheDocument();
    expect(screen.getByText("Bảng điều khiển ra mắt")).toBeInTheDocument();

    // Click next -> Slide 2 (Anti-Cheat)
    const nextBtn = screen.getByLabelText("Slide tiếp theo");
    fireEvent.click(nextBtn);
    expect(screen.getByText("BẢO MẬT")).toBeInTheDocument();
    expect(screen.getByText("Công nghệ giám sát 24/7")).toBeInTheDocument();
    expect(screen.getByText("Tạo bài thi an toàn")).toBeInTheDocument();

    // Click next -> Slide 3 (Tốc độ)
    fireEvent.click(nextBtn);
    expect(screen.getByText("TỐC ĐỘ")).toBeInTheDocument();
    expect(screen.getByText("Kết quả trả về trong 0ms")).toBeInTheDocument();
    expect(screen.getByText("Trải nghiệm tốc độ")).toBeInTheDocument();

    // Click next -> Slide 4 (Phân tích)
    fireEvent.click(nextBtn);
    expect(screen.getByText("PHÂN TÍCH")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo phổ điểm")).toBeInTheDocument();
    expect(screen.getByText("Dùng thử ngay")).toBeInTheDocument();

    // Click next again wraps around to Slide 1
    fireEvent.click(nextBtn);
    expect(screen.getByText("MỚI")).toBeInTheDocument();

    // Click prev wraps to Slide 4
    const prevBtn = screen.getByLabelText("Slide trước");
    fireEvent.click(prevBtn);
    expect(screen.getByText("PHÂN TÍCH")).toBeInTheDocument();
  });

  it("navigates directly to a slide using indicator dots", () => {
    renderLanding();

    const slide3Dot = screen.getByLabelText(/Slide 3: TỐC ĐỘ/i);
    fireEvent.click(slide3Dot);

    expect(screen.getByText("TỐC ĐỘ")).toBeInTheDocument();
    expect(screen.getByText("Kết quả trả về trong 0ms")).toBeInTheDocument();
  });

  it("supports keyboard navigation (ArrowLeft and ArrowRight)", () => {
    renderLanding();

    expect(screen.getByText("MỚI")).toBeInTheDocument();

    // Press ArrowRight -> Slide 2
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("BẢO MẬT")).toBeInTheDocument();

    // Press ArrowLeft -> back to Slide 1
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("MỚI")).toBeInTheDocument();
  });

  it("supports touch swipe navigation", () => {
    renderLanding();

    const heroSection = screen.getByLabelText(/Giới thiệu QuizHub/i);
    expect(screen.getByText("MỚI")).toBeInTheDocument();

    // Swipe left -> Slide 2
    fireEvent.touchStart(heroSection, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(heroSection, { changedTouches: [{ clientX: 100 }] });
    expect(screen.getByText("BẢO MẬT")).toBeInTheDocument();

    // Swipe right -> Slide 1
    fireEvent.touchStart(heroSection, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(heroSection, { changedTouches: [{ clientX: 200 }] });
    expect(screen.getByText("MỚI")).toBeInTheDocument();
  });

  it("auto-advances carousel after interval and respects pause on hover", () => {
    vi.useFakeTimers();
    try {
      renderLanding();

      expect(screen.getByText("MỚI")).toBeInTheDocument();

      // Advance 4500ms
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(screen.getByText("BẢO MẬT")).toBeInTheDocument();

      // Hover pauses auto-advance
      const heroSection = screen.getByLabelText(/Giới thiệu QuizHub/i);
      fireEvent.mouseEnter(heroSection);

      act(() => {
        vi.advanceTimersByTime(4500);
      });
      // Should still be on Slide 2 because paused
      expect(screen.getByText("BẢO MẬT")).toBeInTheDocument();

      // Mouse leave resumes auto-advance
      fireEvent.mouseLeave(heroSection);
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(screen.getByText("TỐC ĐỘ")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects prefers-reduced-motion media query by disabling auto-advance", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    vi.useFakeTimers();
    try {
      renderLanding();
      expect(screen.getByText("MỚI")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Still on Slide 1 because reduced motion is enabled
      expect(screen.getByText("MỚI")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles mobile navigation menu", () => {
    renderLanding();

    const toggleBtn = document.getElementById("mobile-nav-toggle")!;
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");

    // Open mobile menu
    fireEvent.click(toggleBtn);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");

    // Click link to close
    const navLink = screen.getAllByText("Về chúng tôi")[0]!;
    fireEvent.click(navLink);
    expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("redirects authenticated user to role-based dashboard", () => {
    const teacherUser: StoredUser = {
      id: 1,
      email: "teacher@quizhub.com",
      fullName: "Nguyễn Văn Giáo Viên",
      role: "TEACHER",
      avatarUrl: null,
    };
    setSession("fake-jwt-token", teacherUser);

    renderLanding();
    expect(screen.getByText("Teacher Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Bảng điều khiển ra mắt")).not.toBeInTheDocument();
  });

  it("scrolls to top when clicking the floating scroll-to-top button", () => {
    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    renderLanding();

    const scrollBtn = screen.getByLabelText(/Cuộn lên đầu trang/i);
    fireEvent.click(scrollBtn);

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
