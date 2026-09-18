import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
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
    onError: (error) => setFormError(isApiError(error) ? error.message : "Could not send code."),
  });

  const resetPassword = useMutation({
    mutationFn: () => authApi.resetPassword({ email, otp, newPassword, confirmPassword }),
    onSuccess: () => navigate("/login", { replace: true }),
    onError: (error) => setFormError(isApiError(error) ? error.message : "Could not reset password."),
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
      setFormError("Passwords do not match.");
      return;
    }
    resetPassword.mutate();
  }

  return (
    <div className="qh-auth-page">
      <div className="qh-auth-card">
        <h1 className="qh-auth-title">Reset your password</h1>

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
              Send reset code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} noValidate>
            <Input
              label="Reset code"
              name="otp"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <PasswordInput
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <PasswordInput
              label="Confirm new password"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={6}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <Button type="submit" isLoading={resetPassword.isPending} style={{ width: "100%" }}>
              Reset password
            </Button>
          </form>
        )}

        <div className="qh-auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
