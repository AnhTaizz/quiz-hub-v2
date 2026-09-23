import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath, type StoredUser } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import type { Role } from "@/types/api";
import { Spinner } from "@/components/ui/Spinner";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

function base64ToUtf8(value: string): string {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
}

const KNOWN_ROLES: Role[] = ["ADMIN", "TEACHER", "STUDENT"];

type Callback = { kind: "error"; message: string } | { kind: "ok"; token: string; user: StoredUser };

/**
 * Fixes audit finding F-02: the legacy static/oauth2-redirect.html read
 * `error` from the query string and injected it into the DOM via
 * `innerHTML` with a template literal - a reflected DOM-XSS vector from a
 * crafted OAuth callback URL. React renders `error` as a plain text node
 * below, which can never be interpreted as markup.
 */
export function OAuth2RedirectPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  const callback = useMemo<Callback>(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) return { kind: "error", message: errorParam };

    const token = searchParams.get("token");
    const id = searchParams.get("id");
    const email = searchParams.get("email");
    const fullNameB64 = searchParams.get("fullName");
    const roleParam = searchParams.get("role");
    const avatarUrl = searchParams.get("avatarUrl");

    if (!token || !id || !email || !roleParam || !KNOWN_ROLES.includes(roleParam as Role)) {
      return { kind: "error", message: "Phản hồi đăng nhập không hợp lệ. Vui lòng thử lại." };
    }

    return {
      kind: "ok",
      token,
      user: {
        id: Number(id),
        email,
        fullName: fullNameB64 ? base64ToUtf8(fullNameB64) : email,
        role: roleParam as Role,
        avatarUrl: avatarUrl || null,
      },
    };
  }, [searchParams]);

  useEffect(() => {
    if (callback.kind !== "ok") return;
    login(callback.token, callback.user);
    goToSafePath(null, roleHomePath(callback.user.role), navigate);
  }, [callback, login, navigate]);

  if (callback.kind === "error") {
    return (
      <div className="qh-auth-page">
        <PublicHeader />
        <div className="qh-auth-card">
          <h1 className="qh-auth-title">Đăng nhập thất bại</h1>
          <p className="qh-auth-error" role="alert">
            {callback.message}
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
      <Spinner label="Đang đăng nhập" />
    </div>
  );
}
