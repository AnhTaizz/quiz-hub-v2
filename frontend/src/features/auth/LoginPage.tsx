import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // The backend redirects here with ?error=locked when a locked account's token is used
  // (JwtAuthenticationFilter). Shown as plain text, never interpreted as markup.
  const [formError, setFormError] = useState<string | null>(() =>
    searchParams.get("error") === "locked"
      ? "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ."
      : null,
  );

  useEffect(() => {
    document.title = "Đăng nhập | QuizHub";
  }, []);

  const mutation = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess: (auth) => {
      login(auth.token, {
        id: auth.id,
        email: auth.email,
        fullName: auth.fullName,
        role: auth.role,
        avatarUrl: auth.avatarUrl,
      });
      goToSafePath(searchParams.get("returnUrl"), roleHomePath(auth.role), navigate);
    },
    onError: (error) => {
      setFormError(
        isApiError(error) ? error.message : "Email hoặc mật khẩu không chính xác.",
      );
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    mutation.mutate();
  }

  function handleEmailChange(val: string) {
    setEmail(val);
    if (formError) setFormError(null);
  }

  function handlePasswordChange(val: string) {
    setPassword(val);
    if (formError) setFormError(null);
  }

  return (
    <div className="qh-auth-page auth-page-v1">
      <PublicHeader />

      <section className="hero-section auth-hero-section">
        <div className="hero-blob hero-blob-1" aria-hidden="true" />
        <div className="hero-blob hero-blob-2" aria-hidden="true" />

        <div className="container position-relative login-wrapper">
          <div className="auth-card">
            <div className="auth-header text-center">
              <h2>Chào mừng trở lại</h2>
              <p>Đăng nhập để tiếp tục hành trình của bạn</p>
            </div>

            <form id="loginForm" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="email">Địa chỉ Email</label>
                <div className="input-wrapper">
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <input
                    type="email"
                    id="email"
                    className="form-control-auth"
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Mật khẩu</label>
                <div className="input-wrapper" id="passwordWrapper">
                  <i className="bi bi-lock" aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    className={`form-control-auth ${formError ? "is-invalid" : ""}`}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
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
                {formError && (
                  <div id="loginError" className="login-error-box" role="alert">
                    <i className="bi bi-exclamation-circle-fill" aria-hidden="true" />
                    <span id="loginErrorMsg">{formError}</span>
                  </div>
                )}
              </div>

              <div className="auth-links-row">
                <Link to="/forgot-password" className="auth-forgot-link">
                  Quên mật khẩu?
                </Link>
              </div>

              <button
                type="submit"
                id="submitBtn"
                className="btn-auth"
                disabled={mutation.isPending}
                aria-busy={mutation.isPending || undefined}
              >
                {mutation.isPending ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <i className="bi bi-arrow-right" style={{ marginLeft: "8px" }} aria-hidden="true" />
                  </>
                )}
              </button>

              <div className="auth-divider">
                <div className="auth-divider-line" />
                <span>Hoặc</span>
                <div className="auth-divider-line" />
              </div>

              {/* Must be a full-page navigation to Spring Security's OAuth2 endpoint */}
              <a
                href="/oauth2/authorization/google"
                className="btn-auth btn-google"
                aria-label="Đăng nhập bằng Google"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="google-icon"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập bằng Google</span>
              </a>
            </form>

            <div className="auth-footer">
              Chưa có tài khoản? <Link to="/register">Đăng ký miễn phí</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

