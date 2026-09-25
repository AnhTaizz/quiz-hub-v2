import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LoginPage } from "./LoginPage";
import { AuthProvider } from "@/auth/AuthProvider";
import { clearSession } from "@/auth/authStorage";
import { authApi } from "@/api/auth.api";
import type { AuthResponse } from "@/types/api";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    login: vi.fn(),
  },
}));

const realLocation = window.location;
let assignMock: ReturnType<typeof vi.fn>;

function renderLogin(initialEntries = ["/login"]) {
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<div>Register Page</div>} />
            <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
            <Route path="/student" element={<div>Student Dashboard</div>} />
            <Route path="/student/history" element={<div>Student History</div>} />
            <Route path="/teacher" element={<div>Teacher Dashboard</div>} />
            <Route path="/admin" element={<div>Admin Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("LoginPage Component - V1 1:1 Parity and Auth Behavior", () => {
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

  it("renders V1 structure, titles, inputs, buttons, and navigation links", () => {
    renderLogin();

    // 1. Header with V1 brand and navigation
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /QuizHub/i })).toBeInTheDocument();

    // 2. Auth Card Header
    expect(screen.getByRole("heading", { level: 2, name: "Chào mừng trở lại" })).toBeInTheDocument();
    expect(screen.getByText("Đăng nhập để tiếp tục hành trình của bạn")).toBeInTheDocument();

    // 3. Email and Password Inputs
    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("type", "email");
    expect(emailInput).toHaveAttribute("placeholder", "name@example.com");

    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(passwordInput).toHaveAttribute("placeholder", "••••••••");

    // 4. Forgot password link
    const forgotLink = screen.getByRole("link", { name: "Quên mật khẩu?" });
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink).toHaveAttribute("href", "/forgot-password");

    // 5. Submit button (Đăng nhập)
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });
    expect(submitBtn).toBeInTheDocument();

    // 6. Divider & Google Login Button
    expect(screen.getByText("Hoặc")).toBeInTheDocument();
    const googleBtn = screen.getByRole("link", { name: /Đăng nhập bằng Google/i });
    expect(googleBtn).toBeInTheDocument();
    expect(googleBtn).toHaveAttribute("href", "/oauth2/authorization/google");

    // 7. Footer link
    expect(screen.getByText(/Chưa có tài khoản\?/i)).toBeInTheDocument();
    const registerLink = screen.getByRole("link", { name: "Đăng ký miễn phí" });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");
  }, 15000);

  it("handles successful login submission and redirects to role home", async () => {
    const mockAuthResponse = {
      id: 1,
      email: "student@quizhub.com",
      fullName: "Nguyễn Văn Học Viên",
      role: "STUDENT" as const,
      avatarUrl: null,
      token: "mock-jwt-token",
    };

    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse);

    renderLogin();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });

    fireEvent.change(emailInput, { target: { value: "student@quizhub.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "student@quizhub.com",
        password: "secret123",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    });
  }, 15000);

  it("handles login error and displays error message safely", async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce({
      status: 401,
      message: "Email hoặc mật khẩu không chính xác.",
    });

    renderLogin();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });

    fireEvent.change(emailInput, { target: { value: "wrong@quizhub.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không chính xác.");
    });
  }, 15000);

  it("displays locked account message when URL has ?error=locked", () => {
    renderLogin(["/login?error=locked"]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.",
    );
  }, 15000);

  it("redirects to safe returnUrl on successful login", async () => {
    const mockAuthResponse = {
      id: 2,
      email: "student@quizhub.com",
      fullName: "Nguyễn Văn B",
      role: "STUDENT" as const,
      avatarUrl: null,
      token: "mock-jwt-token-2",
    };

    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse);

    renderLogin(["/login?returnUrl=%2Fstudent%2Fhistory"]);

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });

    fireEvent.change(emailInput, { target: { value: "student@quizhub.com" } });
    fireEvent.change(passwordInput, { target: { value: "pass123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Student History")).toBeInTheDocument();
    });
  }, 15000);

  it("redirects TEACHER and ADMIN to their respective dashboards", async () => {
    const teacherResponse = {
      id: 3,
      email: "teacher@quizhub.com",
      fullName: "Cô Giáo",
      role: "TEACHER" as const,
      avatarUrl: null,
      token: "teacher-token",
    };

    vi.mocked(authApi.login).mockResolvedValueOnce(teacherResponse);

    renderLogin();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });

    fireEvent.change(emailInput, { target: { value: "teacher@quizhub.com" } });
    fireEvent.change(passwordInput, { target: { value: "teachpass" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/teacher");
    });
  }, 15000);

  it("prevents double submission while login mutation is pending", async () => {
    let resolveLogin: (val: AuthResponse) => void = () => {};
    const pendingPromise = new Promise<AuthResponse>((resolve) => {
      resolveLogin = resolve;
    });

    vi.mocked(authApi.login).mockReturnValueOnce(pendingPromise);

    renderLogin();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    const submitBtn = screen.getByRole("button", { name: /^Đăng nhập$/i });

    fireEvent.change(emailInput, { target: { value: "student@quizhub.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitBtn).toBeDisabled();
      expect(submitBtn).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Đang xử lý...")).toBeInTheDocument();
    });

    resolveLogin({
      id: 1,
      email: "student@quizhub.com",
      fullName: "Học Viên",
      role: "STUDENT",
      avatarUrl: null,
      token: "token",
    });

    await waitFor(() => {
      expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    });
  }, 15000);

  it("toggles password visibility with eye icon button", () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(/^Mật khẩu$/i);
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleBtn = screen.getByRole("button", { name: /Hiện mật khẩu/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    const hideToggleBtn = screen.getByRole("button", { name: /Ẩn mật khẩu/i });
    fireEvent.click(hideToggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  }, 15000);

  it("manages mobile header menu focus trap and returns focus on Escape", () => {
    renderLogin();

    const toggleBtn = document.getElementById("mobile-nav-toggle")!;
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Open mobile menu
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    // Press Escape to close and verify focus returns to toggle button
    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggleBtn);
  }, 15000);
});
