import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // The backend redirects here with ?error=locked when a locked account's token is used
  // (JwtAuthenticationFilter). Shown as plain text, never interpreted as markup.
  const [formError, setFormError] = useState<string | null>(() =>
    searchParams.get("error") === "locked" ? "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ." : null,
  );

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
      setFormError(isApiError(error) ? error.message : "Đăng nhập thất bại. Vui lòng thử lại.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    mutation.mutate();
  }

  return (
    <div className="qh-auth-page">
      <PublicHeader />
      <form className="qh-auth-card" onSubmit={handleSubmit} noValidate>
        <div className="qh-auth-card__icon"><i className="bi bi-person-lock" /></div>
        <h1 className="qh-auth-title">Chào mừng trở lại</h1>
        <p className="qh-auth-subtitle">Đăng nhập để tiếp tục hành trình học tập</p>

        {formError && (
          <p className="qh-auth-error" role="alert">
            {formError}
          </p>
        )}

        <Input
          label="Địa chỉ email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Mật khẩu"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" isLoading={mutation.isPending} style={{ width: "100%" }}>
          Đăng nhập
        </Button>

        <p className="qh-auth-divider"><span>hoặc tiếp tục với</span></p>
        {/* Must be a full-page navigation to Spring Security's OAuth2 endpoint - not a client-side <Link>. */}
        <a href="/oauth2/authorization/google" className="qh-button qh-button--secondary qh-auth-google">
          <i className="bi bi-google" /> Đăng nhập với Google
        </a>

        <div className="qh-auth-links">
          <Link to="/forgot-password">Quên mật khẩu?</Link>
          <span>Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></span>
        </div>
      </form>
    </div>
  );
}
