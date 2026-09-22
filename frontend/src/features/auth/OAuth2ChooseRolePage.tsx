import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { goToSafePath } from "@/utils/routes";
import "./AuthPages.css";

type ChosenRole = "STUDENT" | "TEACHER";

const ROLE_OPTIONS: { value: ChosenRole; title: string; description: string }[] = [
  {
    value: "STUDENT",
    title: "I'm a student",
    description: "Join classrooms, take quizzes and track your progress.",
  },
  {
    value: "TEACHER",
    title: "I'm a teacher",
    description: "Create questions, manage classrooms and review your students' results.",
  },
];

/**
 * First-login role choice for a new Google user. Identity (email/fullName/avatarUrl) is never read from
 * the URL and never sent by this page - it lives server-side, bound to the oauth2_reg_ticket HttpOnly
 * cookie the backend set right after a real Google callback (see
 * docs/backend/OAUTH2_REGISTRATION_SECURITY.md). This page only fetches a display-only preview of it
 * (GET /auth/oauth2-register/pending) and lets the user pick a role; the POST that actually creates the
 * account sends nothing but that role.
 *
 * The token never appears in a URL (history, Referer, logs): on success the session is written directly
 * through AuthProvider.login(), the same code path as the React OAuth callback.
 */
export function OAuth2ChooseRolePage() {
  const [role, setRole] = useState<ChosenRole | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const pending = useQuery({
    queryKey: ["auth", "oauth2-pending"],
    queryFn: ({ signal }) => authApi.getPendingOAuth2Registration(signal),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (chosen: ChosenRole) => authApi.oauth2Register({ role: chosen }),
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
      setFormError(isApiError(error) ? error.message : "Could not finish creating your account. Please try again.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!role) return;
    setFormError(null);
    mutation.mutate(role);
  }

  if (pending.isLoading) {
    return (
      <div className="qh-auth-page">
        <Spinner label="Loading your Google sign-in" />
      </div>
    );
  }

  if (pending.isError || !pending.data) {
    return (
      <div className="qh-auth-page">
        <div className="qh-auth-card">
          <h1 className="qh-auth-title">Sign-in information missing</h1>
          <p className="qh-auth-error" role="alert">
            We could not read your Google sign-in details. Please start again.
          </p>
          <div className="qh-auth-links">
            <Link to="/login">Back to sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  const info = pending.data;

  return (
    <div className="qh-auth-page">
      <form className="qh-auth-card qh-role-page" onSubmit={handleSubmit} noValidate>
        <h1 className="qh-auth-title">Welcome to QuizHub</h1>
        <p className="qh-role-page__intro">
          Signed in as <strong>{info.fullName}</strong> ({info.email}). Choose how you will use QuizHub to finish
          creating your account.
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
          Continue
        </Button>

        <div className="qh-auth-links">
          <Link to="/login">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
