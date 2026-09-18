import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { resolveSafeReturnPath } from "@/utils/safePath";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
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
    searchParams.get("error") === "locked" ? "Your account has been locked. Please contact support." : null,
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
      const destination = resolveSafeReturnPath(searchParams.get("returnUrl"), roleHomePath(auth.role));
      navigate(destination, { replace: true });
    },
    onError: (error) => {
      setFormError(isApiError(error) ? error.message : "Login failed. Please try again.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    mutation.mutate();
  }

  return (
    <div className="qh-auth-page">
      <form className="qh-auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="qh-auth-title">Sign in to QuizHub</h1>

        {formError && (
          <p className="qh-auth-error" role="alert">
            {formError}
          </p>
        )}

        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" isLoading={mutation.isPending} style={{ width: "100%" }}>
          Sign in
        </Button>

        <p className="qh-auth-divider">or</p>
        {/* Must be a full-page navigation to Spring Security's OAuth2 endpoint - not a client-side <Link>. */}
        <a href="/oauth2/authorization/google" className="qh-button qh-button--secondary qh-auth-google">
          Sign in with Google
        </a>

        <div className="qh-auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
