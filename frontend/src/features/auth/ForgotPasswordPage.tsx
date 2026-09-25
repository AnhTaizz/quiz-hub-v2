import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { Link, Navigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { PublicHeader } from "./PublicHeader";
import { calculatePasswordStrength } from "./passwordStrength";
import "./AuthPages.css";

export type ForgotPasswordStep = 1 | 2 | 3 | 4;

export function ForgotPasswordPage() {
  const { isAuthenticated, user } = useAuth();

  const [step, setStep] = useState<ForgotPasswordStep>(1);
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null);

  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const step1HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const step2HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const step3HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const step4HeadingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    document.title = "Quên mật khẩu | QuizHub";
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function startCountdown(seconds = 60) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setCountdown(seconds);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // 1. Request OTP Mutation
  const requestOtp = useMutation({
    mutationFn: (targetEmail: string) => authApi.forgotPassword(targetEmail),
    onSuccess: () => {
      setFormError(null);
      setFieldErrors({});
      setStep(2);
      startCountdown(60);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 50);
    },
    onError: (error) => {
      if (isApiError(error)) {
        setFormError(error.message || "Email không tồn tại trong hệ thống.");
      } else {
        setFormError("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    },
  });

  // 2. Resend OTP Mutation
  const resendOtp = useMutation({
    mutationFn: (targetEmail: string) => authApi.forgotPassword(targetEmail),
    onSuccess: () => {
      setFormError(null);
      setFieldErrors({});
      setOtpDigits(["", "", "", "", "", ""]);
      setResendSuccessMessage("Mã OTP mới đã được gửi!");
      startCountdown(60);
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 50);
    },
    onError: (error) => {
      setResendSuccessMessage(null);
      if (isApiError(error)) {
        setFormError(error.message || "Không thể gửi lại mã OTP. Vui lòng thử lại sau.");
      } else {
        setFormError("Không thể gửi lại. Thử lại sau.");
      }
    },
  });

  // 3. Reset Password Mutation
  const resetPassword = useMutation({
    mutationFn: () => {
      const fullOtp = otpDigits.join("");
      return authApi.resetPassword({
        email: email.trim(),
        otp: fullOtp,
        newPassword,
        confirmPassword,
      });
    },
    onSuccess: () => {
      setFormError(null);
      setFieldErrors({});
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setStep(4);
      setTimeout(() => {
        step4HeadingRef.current?.focus();
      }, 50);
    },
    onError: (error) => {
      if (isApiError(error)) {
        setFormError(error.message || "OTP không hợp lệ hoặc đã hết hạn.");
      } else {
        setFormError("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    },
  });

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  // Handlers for Step 1
  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setResendSuccessMessage(null);
    const errors: Record<string, string> = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = "Vui lòng nhập địa chỉ email.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Email không đúng định dạng.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    requestOtp.mutate(trimmedEmail);
  }

  // Handlers for Step 2 (OTP)
  function handleOtpChange(index: number, rawVal: string) {
    setFormError(null);
    setResendSuccessMessage(null);
    const cleanDigit = rawVal.replace(/\D/g, "");
    const singleDigit = cleanDigit ? cleanDigit.slice(-1) : "";

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = singleDigit;
      return next;
    });

    if (fieldErrors.otp) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.otp;
        return next;
      });
    }

    if (singleDigit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    setFormError(null);
    setResendSuccessMessage(null);
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!pasteData) return;

    const chars = pasteData.slice(0, 6).split("");
    setOtpDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < 6; i++) {
        next[i] = chars[i] ?? "";
      }
      return next;
    });

    if (fieldErrors.otp) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.otp;
        return next;
      });
    }

    const nextFocusIndex = Math.min(chars.length, 5);
    otpInputRefs.current[nextFocusIndex]?.focus();
  }

  function handleVerifyOtpStep() {
    setFormError(null);
    setResendSuccessMessage(null);
    const fullOtp = otpDigits.join("");
    if (fullOtp.length < 6) {
      setFieldErrors({ otp: "Vui lòng nhập đủ 6 chữ số OTP." });
      return;
    }

    setFieldErrors({});
    setStep(3);
    setTimeout(() => {
      newPasswordInputRef.current?.focus();
    }, 50);
  }

  function handleResendClick() {
    if (countdown > 0 || resendOtp.isPending) return;
    resendOtp.mutate(email.trim());
  }

  // Handlers for Step 3 (Password)
  function handleResetPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const errors: Record<string, string> = {};

    if (newPassword.length < 6) {
      errors.newPassword = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    resetPassword.mutate();
  }

  const strength = calculatePasswordStrength(newPassword);

  return (
    <div className="qh-auth-page auth-page-v1">
      <PublicHeader />

      <section className="hero-section auth-hero-section">
        <div className="hero-blob hero-blob-1" aria-hidden="true" />
        <div className="hero-blob hero-blob-2" aria-hidden="true" />

        <div className="container position-relative login-wrapper">
          <div className="auth-card auth-card-forgot-password">
            {/* Back to Login (or previous step) */}
            {step === 1 && (
              <Link to="/login" className="back-to-login">
                <i className="bi bi-arrow-left" aria-hidden="true" />
                <span>Quay lại đăng nhập</span>
              </Link>
            )}

            {step === 2 && (
              <button
                type="button"
                className="back-to-login"
                onClick={() => {
                  setStep(1);
                  setFormError(null);
                  setFieldErrors({});
                  setTimeout(() => emailInputRef.current?.focus(), 50);
                }}
              >
                <i className="bi bi-arrow-left" aria-hidden="true" />
                <span>Đổi email</span>
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                className="back-to-login"
                onClick={() => {
                  setStep(2);
                  setFormError(null);
                  setFieldErrors({});
                  setTimeout(() => otpInputRefs.current[0]?.focus(), 50);
                }}
              >
                <i className="bi bi-arrow-left" aria-hidden="true" />
                <span>Nhập lại OTP</span>
              </button>
            )}

            {/* Step Progress Indicator (Hidden on Success step 4) */}
            {step < 4 && (
              <div className="step-progress" id="stepProgress" aria-label="Tiến trình khôi phục mật khẩu">
                <div className="step-item">
                  <div
                    className={`step-circle ${step > 1 ? "done" : "active"}`}
                    id="sc1"
                    aria-current={step === 1 ? "step" : undefined}
                  >
                    1
                  </div>
                  <span className={`step-label ${step > 1 ? "done" : "active"}`} id="sl1">
                    Email
                  </span>
                </div>

                <div className={`step-line ${step > 1 ? "done" : ""}`} id="line1" />

                <div className="step-item">
                  <div
                    className={`step-circle ${step > 2 ? "done" : step === 2 ? "active" : ""}`}
                    id="sc2"
                    aria-current={step === 2 ? "step" : undefined}
                  >
                    2
                  </div>
                  <span className={`step-label ${step > 2 ? "done" : step === 2 ? "active" : ""}`} id="sl2">
                    Xác thực
                  </span>
                </div>

                <div className={`step-line ${step > 2 ? "done" : ""}`} id="line2" />

                <div className="step-item">
                  <div
                    className={`step-circle ${step === 3 ? "active" : ""}`}
                    id="sc3"
                    aria-current={step === 3 ? "step" : undefined}
                  >
                    3
                  </div>
                  <span className={`step-label ${step === 3 ? "active" : ""}`} id="sl3">
                    Mật khẩu
                  </span>
                </div>
              </div>
            )}

            {/* General form error alert */}
            {formError && (
              <div className="login-error-box mb-3" role="alert" style={{ marginBottom: "16px" }}>
                <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            {/* Resend success notice */}
            {resendSuccessMessage && (
              <div
                className="alert alert-success d-flex align-items-center mb-3"
                role="status"
                style={{
                  background: "rgba(74, 222, 128, 0.12)",
                  border: "1px solid rgba(74, 222, 128, 0.3)",
                  color: "#4ade80",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  fontSize: "13.5px",
                  marginBottom: "16px",
                  gap: "8px",
                }}
              >
                <i className="bi bi-check-circle-fill" aria-hidden="true" />
                <span>{resendSuccessMessage}</span>
              </div>
            )}

            {/* ══ STEP 1: Nhập Email ══ */}
            {step === 1 && (
              <div className="fp-step-container" id="step1">
                <div className="auth-header text-center">
                  <h2 ref={step1HeadingRef} tabIndex={-1} style={{ outline: "none" }}>
                    Quên mật khẩu?
                  </h2>
                  <p>Nhập email của bạn, chúng tôi sẽ gửi mã OTP để xác thực</p>
                </div>

                <form id="emailForm" onSubmit={handleEmailSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="fpEmail">Địa chỉ Email</label>
                    <div className="input-wrapper">
                      <i className="bi bi-envelope" aria-hidden="true" />
                      <input
                        ref={emailInputRef}
                        type="email"
                        id="fpEmail"
                        name="email"
                        className={`form-control-auth ${fieldErrors.email ? "is-invalid" : ""}`}
                        placeholder="name@example.com"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (formError) setFormError(null);
                          if (fieldErrors.email) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.email;
                              return next;
                            });
                          }
                        }}
                      />
                    </div>
                    {fieldErrors.email && (
                      <div className="field-error-text" role="alert" id="emailError">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.email}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    id="sendOtpBtn"
                    className="btn-auth"
                    disabled={requestOtp.isPending}
                    aria-busy={requestOtp.isPending || undefined}
                    style={{ marginTop: "8px" }}
                  >
                    {requestOtp.isPending ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        <span id="sendOtpText">Đang gửi...</span>
                      </>
                    ) : (
                      <>
                        <span id="sendOtpText">Gửi mã OTP</span>
                        <i className="bi bi-send ms-1" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ══ STEP 2: Nhập OTP ══ */}
            {step === 2 && (
              <div className="fp-step-container" id="step2">
                <div className="auth-header text-center">
                  <h2 ref={step2HeadingRef} tabIndex={-1} style={{ outline: "none" }}>
                    Xác thực OTP
                  </h2>
                  <p>Nhập mã 6 chữ số đã được gửi đến</p>
                  <div className="email-highlight" id="displayEmail">
                    {email}
                  </div>
                </div>

                <div className="otp-group" id="otpGroup" role="group" aria-label="Nhập 6 chữ số OTP">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      id={`otp${idx}`}
                      className={`otp-input ${digit ? "filled" : ""} ${fieldErrors.otp ? "error" : ""}`}
                      type="text"
                      maxLength={1}
                      inputMode="numeric"
                      pattern="[0-9]"
                      autoComplete="one-time-code"
                      aria-label={`Chữ số OTP ${idx + 1}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={idx === 0 ? handleOtpPaste : undefined}
                    />
                  ))}
                </div>

                {fieldErrors.otp && (
                  <div
                    className="field-error-text mb-3"
                    role="alert"
                    style={{ justifyContent: "center", marginBottom: "16px" }}
                  >
                    <i className="bi bi-exclamation-circle" aria-hidden="true" />
                    <span>{fieldErrors.otp}</span>
                  </div>
                )}

                <div className="resend-row">
                  Không nhận được mã?{" "}
                  {countdown > 0 ? (
                    <span className="disabled" id="resendLink">
                      Gửi lại (<span id="countdown">{countdown}</span>s)
                    </span>
                  ) : (
                    <button
                      type="button"
                      id="resendBtn"
                      onClick={handleResendClick}
                      disabled={resendOtp.isPending}
                    >
                      {resendOtp.isPending ? "Đang gửi..." : "Gửi lại"}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  id="verifyOtpBtn"
                  className="btn-auth"
                  onClick={handleVerifyOtpStep}
                >
                  <span id="verifyOtpText">Tiếp tục</span>
                  <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* ══ STEP 3: Đặt mật khẩu mới ══ */}
            {step === 3 && (
              <div className="fp-step-container" id="step3">
                <div className="auth-header text-center">
                  <h2 ref={step3HeadingRef} tabIndex={-1} style={{ outline: "none" }}>
                    Đặt mật khẩu mới
                  </h2>
                  <p>Tạo mật khẩu mạnh để bảo vệ tài khoản của bạn</p>
                </div>

                <form id="resetForm" onSubmit={handleResetPasswordSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="newPassword">Mật khẩu mới</label>
                    <div className="input-wrapper">
                      <i className="bi bi-lock" aria-hidden="true" />
                      <input
                        ref={newPasswordInputRef}
                        type={showNewPassword ? "text" : "password"}
                        id="newPassword"
                        name="newPassword"
                        className={`form-control-auth ${fieldErrors.newPassword ? "is-invalid" : ""}`}
                        placeholder="Ít nhất 6 ký tự"
                        required
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (formError) setFormError(null);
                          if (fieldErrors.newPassword) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.newPassword;
                              return next;
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="toggle-pw"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                      >
                        <i
                          className={`bi ${showNewPassword ? "bi-eye-slash" : "bi-eye"}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>

                    {/* Password Strength Indicator */}
                    <div className="strength-bar-wrap" aria-hidden="true">
                      <div
                        className="strength-bar"
                        id="strengthBar"
                        style={{ width: strength.width, backgroundColor: strength.color }}
                      />
                    </div>
                    {strength.label && (
                      <span className="strength-label" id="strengthLabel" style={{ color: strength.color }}>
                        Độ mạnh: {strength.label}
                      </span>
                    )}

                    {fieldErrors.newPassword && (
                      <div className="field-error-text" role="alert" id="newPwError">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.newPassword}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginTop: "16px" }}>
                    <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                    <div className="input-wrapper">
                      <i className="bi bi-lock-fill" aria-hidden="true" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        name="confirmPassword"
                        className={`form-control-auth ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                        placeholder="Nhập lại mật khẩu"
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (formError) setFormError(null);
                          if (fieldErrors.confirmPassword) {
                            setFieldErrors((prev) => {
                              const next = { ...prev };
                              delete next.confirmPassword;
                              return next;
                            });
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="toggle-pw"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                      >
                        <i
                          className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <div className="field-error-text" role="alert" id="confirmPwError">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.confirmPassword}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    id="resetBtn"
                    className="btn-auth"
                    disabled={resetPassword.isPending}
                    aria-busy={resetPassword.isPending || undefined}
                    style={{ marginTop: "24px" }}
                  >
                    {resetPassword.isPending ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        <span id="resetBtnText">Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <span id="resetBtnText">Đặt lại mật khẩu</span>
                        <i className="bi bi-check-circle ms-1" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* ══ STEP 4: Thành công ══ */}
            {step === 4 && (
              <div className="fp-step-container text-center" id="step4" style={{ padding: "16px 0 8px" }}>
                <div className="success-icon" aria-hidden="true">
                  <i className="bi bi-check-lg" />
                </div>
                <h2
                  ref={step4HeadingRef}
                  tabIndex={-1}
                  style={{ fontSize: "22px", marginBottom: "10px", outline: "none" }}
                >
                  Đặt lại thành công!
                </h2>
                <p style={{ color: "rgba(255, 255, 255, 0.65)", marginBottom: "28px", lineHeight: "1.7", fontSize: "14px" }}>
                  Mật khẩu của bạn đã được cập nhật.
                  <br />
                  Hãy đăng nhập lại để tiếp tục.
                </p>
                <Link
                  to="/login"
                  className="btn-auth"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    textDecoration: "none",
                    width: "100%",
                  }}
                >
                  <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  <span>Đến trang đăng nhập</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
