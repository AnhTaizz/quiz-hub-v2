import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate, Link, Navigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

export type RegisterRole = "STUDENT" | "TEACHER";

export function RegisterPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<RegisterRole | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const step1HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const step2HeadingRef = useRef<HTMLHeadingElement | null>(null);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = "Đăng ký | QuizHub";
  }, []);

  const mutation = useMutation({
    mutationFn: () => {
      if (!role) {
        throw new Error("Vui lòng chọn vai trò trước khi đăng ký.");
      }
      return authApi.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        role,
      });
    },
    onSuccess: (auth) => {
      login(auth.token, {
        id: auth.id,
        email: auth.email,
        fullName: auth.fullName,
        role: auth.role,
        avatarUrl: auth.avatarUrl,
      });
      goToSafePath(null, roleHomePath(auth.role), navigate);
    },
    onError: (error) => {
      if (isApiError(error)) {
        if (error.errors && Object.keys(error.errors).length > 0) {
          setFieldErrors(error.errors);
        }
        setFormError(error.message || "Đăng ký thất bại. Vui lòng thử lại.");
      } else {
        setFormError("Đăng ký thất bại. Vui lòng thử lại.");
      }
    },
  });

  // If already authenticated, redirect to role home
  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  function handleGoStep2() {
    if (!role) return;
    setFormError(null);
    setStep(2);
    setTimeout(() => {
      fullNameInputRef.current?.focus();
    }, 50);
  }

  function handleGoStep1() {
    setFormError(null);
    setFieldErrors({});
    setStep(1);
    setTimeout(() => {
      step1HeadingRef.current?.focus();
    }, 50);
  }

  function handleFieldChange(field: string, value: string, setter: (val: string) => void) {
    setter(value);
    if (formError) setFormError(null);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      errors.fullName = "Vui lòng nhập họ và tên.";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      errors.email = "Vui lòng nhập email.";
    } else if (!emailRegex.test(trimmedEmail)) {
      errors.email = "Email không đúng định dạng.";
    }

    if (password.length < 6) {
      errors.password = "Mật khẩu phải có ít nhất 6 ký tự.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    mutation.mutate();
  }

  return (
    <div className="qh-auth-page auth-page-v1">
      <PublicHeader />

      <section className="hero-section auth-hero-section">
        <div className="hero-blob hero-blob-1" aria-hidden="true" />
        <div className="hero-blob hero-blob-2" aria-hidden="true" />

        <div className="container position-relative login-wrapper">
          <div className="auth-card auth-card-register">
            {/* Step indicator */}
            <div className="step-dots" aria-label={`Bước ${step} trên 2`}>
              <div
                className={`step-dot ${step === 1 ? "active" : "completed"}`}
                id="dot-1"
                aria-current={step === 1 ? "step" : undefined}
              />
              <div
                className={`step-dot ${step === 2 ? "active" : ""}`}
                id="dot-2"
                aria-current={step === 2 ? "step" : undefined}
              />
            </div>

            {/* ══ STEP 1: Chọn vai trò ══ */}
            {step === 1 && (
              <div className="reg-step-container" id="step-1">
                <div className="auth-header text-center">
                  <h2 ref={step1HeadingRef} tabIndex={-1} style={{ outline: "none" }}>
                    Bạn là ai?
                  </h2>
                  <p>Chọn vai trò để có trải nghiệm phù hợp nhất</p>
                </div>

                <div
                  className="role-cards"
                  role="radiogroup"
                  aria-label="Chọn vai trò của bạn"
                >
                  <button
                    type="button"
                    className={`role-card-btn student-card ${role === "STUDENT" ? "selected" : ""}`}
                    id="card-student"
                    role="radio"
                    aria-checked={role === "STUDENT"}
                    onClick={() => {
                      setRole("STUDENT");
                      setFormError(null);
                    }}
                  >
                    <div className="check-badge" aria-hidden="true">
                      <i className="bi bi-check" />
                    </div>
                    <div className="role-icon" aria-hidden="true">
                      <i className="bi bi-mortarboard-fill" />
                    </div>
                    <div className="role-name">Học Sinh</div>
                    <div className="role-desc">
                      Tham gia bài kiểm tra &amp; theo dõi tiến độ
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`role-card-btn teacher-card ${role === "TEACHER" ? "selected" : ""}`}
                    id="card-teacher"
                    role="radio"
                    aria-checked={role === "TEACHER"}
                    onClick={() => {
                      setRole("TEACHER");
                      setFormError(null);
                    }}
                  >
                    <div className="check-badge" aria-hidden="true">
                      <i className="bi bi-check" />
                    </div>
                    <div className="role-icon" aria-hidden="true">
                      <i className="bi bi-person-video3" />
                    </div>
                    <div className="role-name">Giáo Viên</div>
                    <div className="role-desc">
                      Tạo đề thi &amp; quản lý lớp học
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  id="btn-next"
                  className={`btn-next-step ${role ? "ready" : ""}`}
                  disabled={!role}
                  onClick={handleGoStep2}
                >
                  <span>Tiếp tục</span>
                  <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                </button>

                <div className="auth-footer">
                  Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </div>
              </div>
            )}

            {/* ══ STEP 2: Điền thông tin ══ */}
            {step === 2 && (
              <div className="reg-step-container" id="step-2">
                <div className="role-back-badge-wrapper">
                  <button
                    type="button"
                    className={`role-back-badge-btn ${role === "TEACHER" ? "teacher" : "student"}`}
                    id="role-badge"
                    onClick={handleGoStep1}
                    aria-label="Đổi vai trò, quay lại bước 1"
                  >
                    <i className="bi bi-arrow-left" aria-hidden="true" />
                    <span id="badge-text">
                      {role === "TEACHER" ? "👨‍🏫 Giáo Viên" : "👨‍🎓 Học Sinh"}
                    </span>
                  </button>
                </div>

                <div className="auth-header text-center">
                  <h2 ref={step2HeadingRef} tabIndex={-1} style={{ outline: "none" }}>
                    Tạo tài khoản
                  </h2>
                  <p>Điền thông tin để bắt đầu hành trình của bạn</p>
                </div>

                {formError && (
                  <div className="login-error-box mb-3" role="alert" style={{ marginBottom: "16px" }}>
                    <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                <form id="register-form" onSubmit={handleSubmit} noValidate>
                  <div className="form-group">
                    <label htmlFor="fullName">Họ và tên</label>
                    <div className="input-wrapper">
                      <i className="bi bi-person" aria-hidden="true" />
                      <input
                        ref={fullNameInputRef}
                        type="text"
                        id="fullName"
                        className={`form-control-auth ${fieldErrors.fullName ? "is-invalid" : ""}`}
                        placeholder="Nguyễn Văn A"
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(e) => handleFieldChange("fullName", e.target.value, setFullName)}
                      />
                    </div>
                    {fieldErrors.fullName && (
                      <div className="field-error-text" role="alert">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.fullName}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <div className="input-wrapper">
                      <i className="bi bi-envelope" aria-hidden="true" />
                      <input
                        type="email"
                        id="email"
                        className={`form-control-auth ${fieldErrors.email ? "is-invalid" : ""}`}
                        placeholder="email@example.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => handleFieldChange("email", e.target.value, setEmail)}
                      />
                    </div>
                    {fieldErrors.email && (
                      <div className="field-error-text" role="alert">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">Mật khẩu</label>
                    <div className="input-wrapper">
                      <i className="bi bi-lock" aria-hidden="true" />
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        className={`form-control-auth ${fieldErrors.password ? "is-invalid" : ""}`}
                        placeholder="Tối thiểu 6 ký tự"
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => handleFieldChange("password", e.target.value, setPassword)}
                      />
                      <button
                        type="button"
                        className="toggle-pw"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      >
                        <i
                          className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <div className="field-error-text" role="alert">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.password}</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
                    <div className="input-wrapper">
                      <i className="bi bi-lock-fill" aria-hidden="true" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        className={`form-control-auth ${fieldErrors.confirmPassword ? "is-invalid" : ""}`}
                        placeholder="Nhập lại mật khẩu"
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) =>
                          handleFieldChange("confirmPassword", e.target.value, setConfirmPassword)
                        }
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
                      <div className="field-error-text" role="alert">
                        <i className="bi bi-exclamation-circle" aria-hidden="true" />
                        <span>{fieldErrors.confirmPassword}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    id="btn-submit"
                    className="btn-auth"
                    disabled={mutation.isPending}
                    aria-busy={mutation.isPending || undefined}
                    style={{ marginTop: "8px" }}
                  >
                    {mutation.isPending ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true" />
                        <span>Đang đăng ký...</span>
                      </>
                    ) : (
                      <>
                        <span>Đăng ký ngay</span>
                        <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </form>

                <div className="auth-footer">
                  Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
