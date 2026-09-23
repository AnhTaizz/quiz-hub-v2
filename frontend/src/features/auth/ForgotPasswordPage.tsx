import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

export function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  const requestOtp = useMutation({
    mutationFn: () => authApi.forgotPassword(email),
    onSuccess: () => setStep("reset"),
    onError: (error) => setFormError(isApiError(error) ? error.message : "Không thể gửi mã xác nhận."),
  });

  const resetPassword = useMutation({
    mutationFn: () => authApi.resetPassword({ email, otp, newPassword, confirmPassword }),
    onSuccess: () => navigate("/login", { replace: true }),
    onError: (error) => setFormError(isApiError(error) ? error.message : "Không thể đặt lại mật khẩu."),
  });

  function handleRequestSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    requestOtp.mutate();
  }

  function handleResetSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (newPassword !== confirmPassword) {
      setFormError("Mật khẩu xác nhận không khớp.");
      return;
    }
    resetPassword.mutate();
  }

  return (
    <div className="qh-auth-page">
      <PublicHeader />
      <div className="qh-auth-card">
        <div className="qh-auth-card__icon"><i className="bi bi-shield-lock" /></div>
        <h1 className="qh-auth-title">Khôi phục mật khẩu</h1>
        <p className="qh-auth-subtitle">{step === "request" ? "Nhập email để nhận mã xác nhận" : "Nhập mã đã gửi tới email của bạn"}</p>

        {formError && (
          <p className="qh-auth-error" role="alert">
            {formError}
          </p>
        )}

        {step === "request" ? (
          <form onSubmit={handleRequestSubmit} noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" isLoading={requestOtp.isPending} style={{ width: "100%" }}>
              Gửi mã xác nhận
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} noValidate>
            <Input
              label="Mã xác nhận"
              name="otp"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <PasswordInput
              label="Mật khẩu mới"
              name="newPassword"
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordInput
              label="Xác nhận mật khẩu mới"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" isLoading={resetPassword.isPending} style={{ width: "100%" }}>
              Đặt lại mật khẩu
            </Button>
          </form>
        )}

        <div className="qh-auth-links">
          <Link to="/login"><i className="bi bi-arrow-left" /> Quay lại đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
