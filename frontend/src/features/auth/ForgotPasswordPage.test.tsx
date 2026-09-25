import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { AuthProvider } from "@/auth/AuthProvider";
import { clearSession, setSession } from "@/auth/authStorage";
import { authApi } from "@/api/auth.api";
import { calculatePasswordStrength } from "./passwordStrength";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}));

function renderForgotPassword(initialEntries = ["/forgot-password"]) {
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
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/student" element={<div>Student Dashboard</div>} />
            <Route path="/teacher" element={<div>Teacher Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("ForgotPasswordPage Component - V1 4-Step Parity and Auth Behavior", () => {
  beforeEach(() => {
    clearSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearSession();
    vi.useRealTimers();
  });

  it("1. renders Step 1 (Email) by default with progress indicator and navigation links", () => {
    renderForgotPassword();

    // 1. Header & Progress
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByLabelText("Tiến trình khôi phục mật khẩu")).toBeInTheDocument();
    expect(screen.getByText("Email")).toHaveClass("active");

    // 2. Back to login link
    const backLinks = screen.getAllByRole("link", { name: /Quay lại đăng nhập/i });
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
    expect(backLinks[0]).toHaveAttribute("href", "/login");

    // 3. Step 1 content
    expect(screen.getByRole("heading", { level: 2, name: "Quên mật khẩu?" })).toBeInTheDocument();
    expect(
      screen.getByText("Nhập email của bạn, chúng tôi sẽ gửi mã OTP để xác thực"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Địa chỉ Email$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gửi mã OTP/i })).toBeInTheDocument();
  });

  it("2. does not call API when email is empty or invalid format", () => {
    renderForgotPassword();

    const submitBtn = screen.getByRole("button", { name: /Gửi mã OTP/i });

    // 1. Empty email
    fireEvent.click(submitBtn);
    expect(screen.getByText("Vui lòng nhập địa chỉ email.")).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();

    // 2. Invalid email format
    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.click(submitBtn);
    expect(screen.getByText("Email không đúng định dạng.")).toBeInTheDocument();
    expect(authApi.forgotPassword).not.toHaveBeenCalled();
  });

  it("3. transitions to Step 2 (OTP) on successful OTP request and starts countdown", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("Mã OTP đã được gửi!");

    renderForgotPassword();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith("user@example.com");
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Xác thực OTP" })).toBeInTheDocument();
    });

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByLabelText("Chữ số OTP 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Chữ số OTP 6")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("Xác thực")).toHaveClass("active");
  });

  it("4. displays backend error message when forgotPassword API fails", async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue({
      status: 404,
      message: "Email không tồn tại trong hệ thống.",
    });

    renderForgotPassword();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    fireEvent.change(emailInput, { target: { value: "notfound@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));

    await waitFor(() => {
      expect(screen.getByText("Email không tồn tại trong hệ thống.")).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { level: 2, name: "Xác thực OTP" })).not.toBeInTheDocument();
  });

  it("5. prevents double submission while requestOtp mutation is pending", async () => {
    let resolvePromise: (val: string) => void;
    const pendingPromise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(authApi.forgotPassword).mockReturnValue(pendingPromise);

    renderForgotPassword();

    const emailInput = screen.getByLabelText(/^Địa chỉ Email$/i);
    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    const submitBtn = screen.getByRole("button", { name: /Gửi mã OTP/i });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledTimes(1);
    });

    expect(submitBtn).toBeDisabled();
    expect(screen.getByText("Đang gửi...")).toBeInTheDocument();

    // Second click does nothing
    fireEvent.click(submitBtn);
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(1);

    resolvePromise!("Success");
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Xác thực OTP" })).toBeInTheDocument();
    });
  });

  it("6. accepts only numeric input in OTP boxes and filters non-numeric characters", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    const otp0 = screen.getByLabelText("Chữ số OTP 1");
    fireEvent.change(otp0, { target: { value: "abc" } });
    expect(otp0).toHaveValue("");

    fireEvent.change(otp0, { target: { value: "9" } });
    expect(otp0).toHaveValue("9");
  });

  it("7. auto focuses next digit input upon entering a digit", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    const otp0 = screen.getByLabelText("Chữ số OTP 1");
    const otp1 = screen.getByLabelText("Chữ số OTP 2");

    fireEvent.change(otp0, { target: { value: "5" } });
    expect(document.activeElement).toBe(otp1);
  });

  it("8. navigates to previous OTP input on Backspace when current box is empty", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    const otp0 = screen.getByLabelText("Chữ số OTP 1");
    const otp1 = screen.getByLabelText("Chữ số OTP 2");

    fireEvent.change(otp0, { target: { value: "1" } });
    expect(document.activeElement).toBe(otp1);

    // Press Backspace in empty otp1
    fireEvent.keyDown(otp1, { key: "Backspace" });
    expect(document.activeElement).toBe(otp0);
  });

  it("9. supports pasting a full 6-digit OTP code across all inputs", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    const otp0 = screen.getByLabelText("Chữ số OTP 1");
    fireEvent.paste(otp0, {
      clipboardData: {
        getData: () => "849201",
      },
    });

    expect(screen.getByLabelText("Chữ số OTP 1")).toHaveValue("8");
    expect(screen.getByLabelText("Chữ số OTP 2")).toHaveValue("4");
    expect(screen.getByLabelText("Chữ số OTP 3")).toHaveValue("9");
    expect(screen.getByLabelText("Chữ số OTP 4")).toHaveValue("2");
    expect(screen.getByLabelText("Chữ số OTP 5")).toHaveValue("0");
    expect(screen.getByLabelText("Chữ số OTP 6")).toHaveValue("1");
  });

  it("10. prevents advancing to Step 3 when OTP is incomplete (< 6 digits)", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    // Enter only 3 digits
    fireEvent.change(screen.getByLabelText("Chữ số OTP 1"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Chữ số OTP 2"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Chữ số OTP 3"), { target: { value: "3" } });

    const continueBtn = screen.getByRole("button", { name: /Tiếp tục/i });
    fireEvent.click(continueBtn);

    expect(screen.getByText("Vui lòng nhập đủ 6 chữ số OTP.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Đặt mật khẩu mới" })).not.toBeInTheDocument();
  });

  it("11. transitions to Step 3 (New Password) when OTP is fully entered (6 digits)", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByRole("heading", { level: 2, name: "Đặt mật khẩu mới" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mật khẩu mới$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Xác nhận mật khẩu$/i)).toBeInTheDocument();
    expect(screen.getByText("Mật khẩu")).toHaveClass("active");
  });

  it("12. does NOT call any imaginary backend verify OTP endpoint at Step 2", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "654321" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    expect(screen.getByRole("heading", { level: 2, name: "Đặt mật khẩu mới" })).toBeInTheDocument();
    // forgotPassword was called once for step 1, resetPassword not called yet
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(1);
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it("13. disables resend link and shows countdown while countdown timer is active", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    expect(screen.getByText("60")).toBeInTheDocument();
    const resendLink = document.getElementById("resendLink");
    expect(resendLink).toBeInTheDocument();
    expect(resendLink).toHaveClass("disabled");
    expect(screen.queryByRole("button", { name: /^Gửi lại$/i })).not.toBeInTheDocument();
  });

  it("14. enables resend button after fake timer advances 60 seconds to 0", async () => {
    vi.useFakeTimers();
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByLabelText("Chữ số OTP 1")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gửi lại$/i })).not.toBeInTheDocument();

    // Advance remaining 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    // Countdown reached 0: disabled resend link is replaced with active button
    expect(document.getElementById("resendLink")).not.toBeInTheDocument();
    const resendBtn = screen.getByRole("button", { name: /^Gửi lại$/i });
    expect(resendBtn).toBeInTheDocument();
    expect(resendBtn).not.toBeDisabled();
  });

  it("15. resends OTP to the current email, clears OTP fields, displays success notice, and restarts countdown", async () => {
    vi.useFakeTimers();
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByLabelText("Chữ số OTP 1")).toBeInTheDocument();
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(1);
    expect(authApi.forgotPassword).toHaveBeenCalledWith("user@example.com");

    // Fast forward to countdown 0
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Enter some test OTP digits
    const otp0 = screen.getByLabelText("Chữ số OTP 1");
    act(() => {
      fireEvent.change(otp0, { target: { value: "7" } });
    });
    expect(otp0).toHaveValue("7");

    const resendBtn = screen.getByRole("button", { name: /^Gửi lại$/i });
    expect(resendBtn).toBeInTheDocument();

    // Click resend
    await act(async () => {
      fireEvent.click(resendBtn);
      await vi.advanceTimersByTimeAsync(100);
    });

    // Assert 2nd call to API with same email
    expect(authApi.forgotPassword).toHaveBeenCalledTimes(2);
    expect(authApi.forgotPassword).toHaveBeenLastCalledWith("user@example.com");

    // Assert OTP fields were reset
    expect(screen.getByLabelText("Chữ số OTP 1")).toHaveValue("");

    // Assert success notice
    expect(screen.getByText("Mã OTP mới đã được gửi!")).toBeInTheDocument();

    // Assert countdown restarted back to 60
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(document.getElementById("resendLink")).toHaveClass("disabled");
  });

  it("16. handles resend API failure by displaying server error and avoiding false success", async () => {
    vi.useFakeTimers();
    vi.mocked(authApi.forgotPassword).mockResolvedValueOnce("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
      await vi.advanceTimersByTimeAsync(100);
    });

    // Fast forward to countdown 0
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    const resendBtn = screen.getByRole("button", { name: /^Gửi lại$/i });
    expect(resendBtn).toBeInTheDocument();

    // Mock failure on resend
    vi.mocked(authApi.forgotPassword).mockRejectedValueOnce({
      status: 500,
      message: "Không thể kết nối máy chủ gửi mail.",
    });

    await act(async () => {
      fireEvent.click(resendBtn);
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText("Không thể kết nối máy chủ gửi mail.")).toBeInTheDocument();
    expect(screen.queryByText("Mã OTP mới đã được gửi!")).not.toBeInTheDocument();
  });

  it("17. cleans up interval timers upon unmount and when timer expires", async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    const { unmount } = renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByLabelText("Chữ số OTP 1")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();

    // Unmount during active countdown
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("18. toggles new password and confirm password visibility independently", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const newPw = screen.getByLabelText(/^Mật khẩu mới$/i);
    const confirmPw = screen.getByLabelText(/^Xác nhận mật khẩu$/i);
    expect(newPw).toHaveAttribute("type", "password");
    expect(confirmPw).toHaveAttribute("type", "password");

    const toggleNewBtn = screen.getByRole("button", { name: "Hiện mật khẩu mới" });
    const toggleConfirmBtn = screen.getByRole("button", { name: "Hiện xác nhận mật khẩu" });

    // Toggle new password
    fireEvent.click(toggleNewBtn);
    expect(newPw).toHaveAttribute("type", "text");
    expect(confirmPw).toHaveAttribute("type", "password");

    // Toggle confirm password
    fireEvent.click(toggleConfirmBtn);
    expect(confirmPw).toHaveAttribute("type", "text");

    // Toggle back
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu mới" }));
    expect(newPw).toHaveAttribute("type", "password");
  });

  it("19. validates new password length and password mismatch at Step 3", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    const submitBtn = screen.getByRole("button", { name: /Đặt lại mật khẩu/i });

    // 1. Password < 6 chars
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "123" } });
    fireEvent.click(submitBtn);
    expect(screen.getByText("Mật khẩu phải có ít nhất 6 ký tự.")).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();

    // 2. Mismatched passwords
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "different456" } });
    fireEvent.click(submitBtn);
    expect(screen.getByText("Mật khẩu xác nhận không khớp.")).toBeInTheDocument();
    expect(authApi.resetPassword).not.toHaveBeenCalled();
  });

  it("20. calculates password strength helper correctly across levels", () => {
    expect(calculatePasswordStrength("").score).toBe(0);
    expect(calculatePasswordStrength("12345").label).toBe("Rất yếu");
    expect(calculatePasswordStrength("123456").label).toBe("Yếu");
    expect(calculatePasswordStrength("123456aB").label).toBe("Trung bình");
    expect(calculatePasswordStrength("LongPassword123").label).toBe("Mạnh");
    expect(calculatePasswordStrength("SuperSecure!Pass123").label).toBe("Rất mạnh");
  });

  it("21. calls resetPassword API with exact payload { email, otp, newPassword, confirmPassword }", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    vi.mocked(authApi.resetPassword).mockResolvedValue("Đặt lại mật khẩu thành công!");

    renderForgotPassword();

    // Step 1
    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    // Step 2
    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "987654" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    // Step 3
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "newPassword123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "newPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu/i }));

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        otp: "987654",
        newPassword: "newPassword123",
        confirmPassword: "newPassword123",
      });
    });
  });

  it("22. stays on Step 3 and shows error when resetPassword API rejects with invalid/expired OTP", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    vi.mocked(authApi.resetPassword).mockRejectedValue({
      status: 400,
      message: "OTP không hợp lệ hoặc đã hết hạn.",
    });

    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "newPassword123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "newPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu/i }));

    await waitFor(() => {
      expect(screen.getByText("OTP không hợp lệ hoặc đã hết hạn.")).toBeInTheDocument();
    });

    // Never advances to success screen
    expect(screen.queryByRole("heading", { level: 2, name: "Đặt lại thành công!" })).not.toBeInTheDocument();
  });

  it("23. transitions to Step 4 (Success screen) upon successful password reset", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    vi.mocked(authApi.resetPassword).mockResolvedValue("Đặt lại mật khẩu thành công!");

    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "newPassword123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "newPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Đặt lại thành công!" })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Mật khẩu của bạn đã được cập nhật\./i),
    ).toBeInTheDocument();
    // Step progress is hidden on success screen
    expect(screen.queryByLabelText("Tiến trình khôi phục mật khẩu")).not.toBeInTheDocument();
  });

  it("24. success screen provides a button that navigates directly to /login", async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue("OK");
    vi.mocked(authApi.resetPassword).mockResolvedValue("OK");

    renderForgotPassword();

    fireEvent.change(screen.getByLabelText(/^Địa chỉ Email$/i), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Gửi mã OTP/i }));
    await waitFor(() => screen.getByLabelText("Chữ số OTP 1"));

    fireEvent.paste(screen.getByLabelText("Chữ số OTP 1"), {
      clipboardData: { getData: () => "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tiếp tục/i }));

    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới$/i), { target: { value: "newPassword123" } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu$/i), { target: { value: "newPassword123" } });
    fireEvent.click(screen.getByRole("button", { name: /Đặt lại mật khẩu/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "Đặt lại thành công!" })).toBeInTheDocument();
    });

    const loginBtn = screen.getByRole("link", { name: /Đến trang đăng nhập/i });
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn).toHaveAttribute("href", "/login");
  });

  it("25. maintains PublicHeader and navigation links on ForgotPasswordPage", () => {
    renderForgotPassword();

    const brandLink = screen.getByRole("link", { name: /QuizHub - Trang chủ/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");

    const loginLink = screen.getAllByRole("link", { name: "Đăng nhập" })[0];
    expect(loginLink).toHaveAttribute("href", "/login");

    const signupLink = screen.getByRole("link", { name: "Dùng miễn phí" });
    expect(signupLink).toHaveAttribute("href", "/register");
  });

  it("26. manages mobile drawer menu and keyboard interaction on ForgotPasswordPage", () => {
    renderForgotPassword();

    const toggleBtn = document.getElementById("mobile-nav-toggle")!;
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(toggleBtn);
  });

  it("27. redirects authenticated users to their role home dashboard", () => {
    setSession("valid-token", {
      id: 88,
      email: "student@example.com",
      fullName: "Đã Đăng Nhập",
      role: "STUDENT",
      avatarUrl: null,
    });

    renderForgotPassword();

    expect(screen.getByText("Student Dashboard")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2, name: "Quên mật khẩu?" })).not.toBeInTheDocument();
  });
});
