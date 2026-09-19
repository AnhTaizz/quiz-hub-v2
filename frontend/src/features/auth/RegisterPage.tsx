import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { isApiError } from "@/api/httpClient";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import "./AuthPages.css";

type RegisterRole = "STUDENT" | "TEACHER";

export function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<RegisterRole>("STUDENT");
  const [formError, setFormError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => authApi.register({ fullName, email, password, confirmPassword, role }),
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
      setFormError(isApiError(error) ? error.message : "Registration failed. Please try again.");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="qh-auth-page">
      <form className="qh-auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="qh-auth-title">Create your account</h1>

        {formError && (
          <p className="qh-auth-error" role="alert">
            {formError}
          </p>
        )}

        <Input
          label="Full name"
          name="fullName"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <fieldset className="qh-role-fieldset">
          <legend>I am a...</legend>
          <label className="qh-role-option">
            <input
              type="radio"
              name="role"
              value="STUDENT"
              checked={role === "STUDENT"}
              onChange={() => setRole("STUDENT")}
            />
            Student
          </label>
          <label className="qh-role-option">
            <input
              type="radio"
              name="role"
              value="TEACHER"
              checked={role === "TEACHER"}
              onChange={() => setRole("TEACHER")}
            />
            Teacher
          </label>
        </fieldset>

        <Button type="submit" isLoading={mutation.isPending} style={{ width: "100%" }}>
          Create account
        </Button>

        <div className="qh-auth-links">
          <Link to="/login">Already have an account?</Link>
        </div>
      </form>
    </div>
  );
}
