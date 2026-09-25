import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { RegisterPage } from "./RegisterPage";
import { AuthProvider } from "@/auth/AuthProvider";
import { clearSession } from "@/auth/authStorage";
import { authApi } from "@/api/auth.api";
import type { AuthResponse } from "@/types/api";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    register: vi.fn(),
  },
}));

const realLocation = window.location;
let assignMock: ReturnType<typeof vi.fn>;

function renderRegister(initialEntries = ["/register"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/student" element={<div>Student Dashboard</div>} />
            <Route path="/teacher" element={<div>Teacher Dashboard</div>} />
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("RegisterPage Component - V1 2-Step Parity and Auth Behavior", () => {
  beforeEach(() => {
    clearSession();
    vi.clearAllMocks();
    assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...realLocation, assign: assignMock },
    });
  });

  afterEach(() => {
    clearSession();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: realLocation,
    });
  });

  it("1. renders Step 1 by default with role selection cards and disabled Next button", () => {
    renderRegister();

    // Header brand
    expect(screen.getByRole("banner")).toBeInTheDocument();

    // Step dots
    expect(screen.getByLabelText("Bước 1 trên 2")).toBeInTheDocument();

    // Step 1 Header
    expect(screen.getByRole("heading", { level: 2, name: "Bạn là ai?" })).toBeInTheDocument();
    expect(screen.getByText("Chọn vai trò để có trải nghiệm phù hợp nhất")).toBeInTheDocument();

    // Role Cards
    const studentCard = screen.getByRole("radio", { name: /Học Sinh/i });
    const teacherCard = screen.getByRole("radio", { name: /Giáo Viên/i });
    expect(studentCard).toBeInTheDocument();
    expect(teacherCard).toBeInTheDocument();
    expect(studentCard).toHaveAttribute("aria-checked", "false");
    expect(teacherCard).toHaveAttribute("aria-checked", "false");

    // Next Button (disabled initially)
    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    expect(nextBtn).toBeInTheDocument();
    expect(nextBtn).toBeDisabled();

    // Login link in header and footer
    const loginLinks = screen.getAllByRole("link", { name: "Đăng nhập" });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    loginLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/login");
    });
  });

  it("2. does not advance to Step 2 when clicking disabled Next button without selecting role", () => {
    renderRegister();

    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    fireEvent.click(nextBtn);

    // Still in Step 1
    expect(screen.getByRole("heading", { level: 2, name: "Bạn là ai?" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Tạo tài khoản" })).not.toBeInTheDocument();
  });

  it("3. selects STUDENT role and enables Next button", () => {
    renderRegister();

    const studentCard = screen.getByRole("radio", { name: /Học Sinh/i });
    fireEvent.click(studentCard);

    expect(studentCard).toHaveAttribute("aria-checked", "true");
    expect(studentCard).toHaveClass("selected");

    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    expect(nextBtn).not.toBeDisabled();
    expect(nextBtn).toHaveClass("ready");
  });

  it("4. selects TEACHER role, updates selection, and enables Next button", () => {
    renderRegister();

    const studentCard = screen.getByRole("radio", { name: /Học Sinh/i });
    const teacherCard = screen.getByRole("radio", { name: /Giáo Viên/i });

    fireEvent.click(studentCard);
    expect(studentCard).toHaveAttribute("aria-checked", "true");

    fireEvent.click(teacherCard);
    expect(teacherCard).toHaveAttribute("aria-checked", "true");
    expect(teacherCard).toHaveClass("selected");
    expect(studentCard).toHaveAttribute("aria-checked", "false");
    expect(studentCard).not.toHaveClass("selected");

    const nextBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("5. transitions to Step 2 with STUDENT role badge and renders all form fields", () => {
    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step dots updated
    expect(screen.getByLabelText("Bước 2 trên 2")).toBeInTheDocument();

    // Step 2 badge & header
    const badge = screen.getByRole("button", { name: /Đổi vai trò, quay lại bước 1/i });
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("👨‍🎓 Học Sinh");
    expect(screen.getByRole("heading", { level: 2, name: "Tạo tài khoản" })).toBeInTheDocument();

    // Form inputs
    expect(screen.getByLabelText(/^Họ và tên$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Xác nhận mật khẩu$/i)).toBeInTheDocument();

    // Submit button
    expect(screen.getByRole("button", { name: /Đăng ký ngay/i })).toBeInTheDocument();
  });

  it("6. navigates back from Step 2 to Step 1 using role-back-badge", () => {
    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByRole("heading", { level: 2, name: "Tạo tài khoản" })).toBeInTheDocument();

    // Click back badge
    const badge = screen.getByRole("button", { name: /Đổi vai trò, quay lại bước 1/i });
    fireEvent.click(badge);

    // Returned to Step 1
    expect(screen.getByRole("heading", { level: 2, name: "Bạn là ai?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Học Sinh/i })).toHaveAttribute("aria-checked", "true");
  });

  it("7. persists entered form data when toggling between Step 1 and Step 2 and changing role", () => {
    renderRegister();

    // Step 1 -> Student
    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Enter info
    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Trần Văn B" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "tranvanb@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "secret123" } });

    // Go back to Step 1
    fireEvent.click(screen.getByRole("button", { name: /Đổi vai trò, quay lại bước 1/i }));

    // Switch role to Teacher
    fireEvent.click(screen.getByRole("radio", { name: /Giáo Viên/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Badge updated to Teacher
    expect(screen.getByRole("button", { name: /Đổi vai trò, quay lại bước 1/i })).toHaveTextContent("👨‍🏫 Giáo Viên");

    // Form values retained
    expect(screen.getByLabelText(/^Họ và tên$/i)).toHaveValue("Trần Văn B");
    expect(screen.getByLabelText(/^Email$/i)).toHaveValue("tranvanb@example.com");
    expect(screen.getByLabelText(/^Mật khẩu$/i)).toHaveValue("secret123");
    expect(screen.getByLabelText(/^Xác nhận mật khẩu$/i)).toHaveValue("secret123");
  });

  it("8. validates required fields, email format, password length, and password mismatch", () => {
    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const submitBtn = screen.getByRole("button", { name: /Đăng ký ngay/i });

    // 1. Submit empty form
    fireEvent.click(submitBtn);
    expect(screen.getByText("Vui lòng nhập họ và tên.")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập email.")).toBeInTheDocument();
    expect(screen.getByText("Mật khẩu phải có ít nhất 6 ký tự.")).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();

    // 2. Invalid email format
    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Nguyễn Văn A" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "invalid-email" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "123456" } });
    fireEvent.click(submitBtn);
    expect(screen.getByText("Email không đúng định dạng.")).toBeInTheDocument();

    // 3. Password mismatch
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "valid@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "654321" } });
    fireEvent.click(submitBtn);
    expect(screen.getByText("Mật khẩu xác nhận không khớp.")).toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("9. toggles password and confirmPassword visibility independently", () => {
    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const pwInput = screen.getByLabelText(/^Mật khẩu$/i);
    const confirmPwInput = screen.getByLabelText(/^Xác nhận mật khẩu$/i);

    expect(pwInput).toHaveAttribute("type", "password");
    expect(confirmPwInput).toHaveAttribute("type", "password");

    const pwToggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    const confirmPwToggle = screen.getByRole("button", { name: "Hiện xác nhận mật khẩu" });

    // Toggle password
    fireEvent.click(pwToggle);
    expect(pwInput).toHaveAttribute("type", "text");
    expect(confirmPwInput).toHaveAttribute("type", "password");

    // Toggle confirm password
    fireEvent.click(confirmPwToggle);
    expect(confirmPwInput).toHaveAttribute("type", "text");

    // Toggle back
    fireEvent.click(pwToggle);
    expect(pwInput).toHaveAttribute("type", "password");
  });

  it("10. handles successful STUDENT registration and navigates to /student", async () => {
    const mockAuthResponse: AuthResponse = {
      id: 10,
      email: "student@example.com",
      fullName: "Nguyễn Học Sinh",
      role: "STUDENT",
      token: "jwt-student-token",
      avatarUrl: null,
    };
    vi.mocked(authApi.register).mockResolvedValue(mockAuthResponse);

    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Nguyễn Học Sinh" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Đăng ký ngay/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        fullName: "Nguyễn Học Sinh",
        email: "student@example.com",
        password: "password123",
        confirmPassword: "password123",
        role: "STUDENT",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    });
  });

  it("11. handles successful TEACHER registration and navigates to /teacher", async () => {
    const mockAuthResponse: AuthResponse = {
      id: 20,
      email: "teacher@example.com",
      fullName: "Cô Giáo Viên",
      role: "TEACHER",
      token: "jwt-teacher-token",
      avatarUrl: null,
    };
    vi.mocked(authApi.register).mockResolvedValue(mockAuthResponse);

    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Giáo Viên/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Cô Giáo Viên" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "teacher@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "teacherpass" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "teacherpass" } });

    fireEvent.click(screen.getByRole("button", { name: /Đăng ký ngay/i }));

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        fullName: "Cô Giáo Viên",
        email: "teacher@example.com",
        password: "teacherpass",
        confirmPassword: "teacherpass",
        role: "TEACHER",
      });
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/teacher");
    });
  });

  it("12. displays backend registration error message gracefully", async () => {
    vi.mocked(authApi.register).mockRejectedValue({
      status: 400,
      message: "Email này đã được sử dụng. Vui lòng dùng email khác.",
    });

    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Nguyễn Văn A" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "existing@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "password123" } });

    fireEvent.click(screen.getByRole("button", { name: /Đăng ký ngay/i }));

    await waitFor(() => {
      expect(screen.getByText("Email này đã được sử dụng. Vui lòng dùng email khác.")).toBeInTheDocument();
    });
  });

  it("13. prevents double submission while register mutation is pending", async () => {
    let resolvePromise: (value: AuthResponse) => void;
    const pendingPromise = new Promise<AuthResponse>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(authApi.register).mockReturnValue(pendingPromise);

    renderRegister();

    fireEvent.click(screen.getByRole("radio", { name: /Học Sinh/i }));
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Họ và tên$/i), { target: { value: "Nguyễn Văn A" } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu$/i), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "password123" } });

    const submitBtn = screen.getByRole("button", { name: /Đăng ký ngay/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledTimes(1);
    });

    expect(submitBtn).toBeDisabled();
    expect(screen.getByText("Đang đăng ký...")).toBeInTheDocument();

    // Second click does nothing
    fireEvent.click(submitBtn);
    expect(authApi.register).toHaveBeenCalledTimes(1);

    resolvePromise!({
      id: 30,
      email: "user@example.com",
      fullName: "Nguyễn Văn A",
      role: "STUDENT",
      token: "tok",
      avatarUrl: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    });
  });
});
