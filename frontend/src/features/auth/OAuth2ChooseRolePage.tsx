import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { Button } from "@/components/ui/Button";
import { goToSafePath } from "@/utils/routes";
import { parseChooseRoleParams } from "./oauthParams";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

type ChosenRole = "STUDENT" | "TEACHER";

const ROLE_OPTIONS: { value: ChosenRole; title: string; description: string }[] = [
  {
    value: "STUDENT",
    title: "Tôi là học viên",
    description: "Tham gia lớp học, làm bài thi và theo dõi tiến độ.",
  },
  {
    value: "TEACHER",
    title: "Tôi là giáo viên",
    description: "Tạo câu hỏi, quản lý lớp học và xem kết quả học viên.",
  },
];

/**
 * First-login role choice for a new Google user. Replaces static/oauth2-choose-role.html, which built its error
 * toast with innerHTML. Everything from the URL or the server is rendered as text.
 *
 * On success the session is written directly through AuthProvider.login() - the same code path as the React
 * OAuth callback - so, unlike the legacy hop through /oauth2-redirect.html?token=..., the token never appears
 * in a URL (history, Referer, logs).
 */
export function OAuth2ChooseRolePage() {
  const [searchParams] = useSearchParams();
  const params = useMemo(() => parseChooseRoleParams(searchParams), [searchParams]);
  const [role, setRole] = useState<ChosenRole | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (chosen: ChosenRole) => {
      if (!params) throw new Error("Missing sign-in information");
      return authApi.oauth2Register({
        email: params.email,
        fullName: params.fullName,
        avatarUrl: params.avatarUrl,
        role: chosen,
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
      setFormError(isApiError(error) ? error.message : "Không thể hoàn tất tạo tài khoản. Vui lòng thử lại.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role) return;
    setFormError(null);
    mutation.mutate(role);
  }

  if (!params) {
    return (
      <div className="qh-auth-page">
        <PublicHeader />
        <div className="qh-auth-card">
          <h1 className="qh-auth-title">Thiếu thông tin đăng nhập</h1>
          <p className="qh-auth-error" role="alert">
            Không thể đọc thông tin đăng nhập Google. Vui lòng bắt đầu lại.
          </p>
          <div className="qh-auth-links">
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="qh-auth-page">
      <PublicHeader />
      <form className="qh-auth-card qh-role-page" onSubmit={handleSubmit} noValidate>
        <h1 className="qh-auth-title">Chào mừng đến QuizHub</h1>
        <p className="qh-role-page__intro">
          Bạn đang đăng nhập với tên <strong>{params.fullName}</strong> ({params.email}). Chọn vai trò để hoàn tất tạo tài khoản.
        </p>

        {formError && (
          <p className="qh-auth-error" role="alert">
            {formError}
          </p>
        )}

        <fieldset className="qh-role-cards">
          <legend className="visually-hidden">Choose your role</legend>
          {ROLE_OPTIONS.map((option) => (
            <label key={option.value} className={`qh-role-card ${role === option.value ? "qh-role-card--selected" : ""}`}>
              <input
                type="radio"
                name="role"
                value={option.value}
                checked={role === option.value}
                onChange={() => setRole(option.value)}
                className="qh-role-card__input"
              />
              <span className="qh-role-card__title">{option.title}</span>
              <span className="qh-role-card__description">{option.description}</span>
            </label>
          ))}
        </fieldset>

        <Button type="submit" disabled={!role} isLoading={mutation.isPending} style={{ width: "100%" }}>
          Tiếp tục
        </Button>

        <div className="qh-auth-links">
          <Link to="/login">Hủy</Link>
        </div>
      </form>
    </div>
  );
}
