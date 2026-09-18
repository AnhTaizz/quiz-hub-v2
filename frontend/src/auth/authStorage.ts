import type { Role } from "@/types/api";

// Single source of truth for client auth state, replacing the
// `localStorage.getItem('token') || sessionStorage.getItem('token')` pattern
// copy-pasted across ~10 legacy JS files (audit finding, JS architecture
// section). The non-HttpOnly `jwt` cookie is preserved deliberately: the
// backend's JwtAuthenticationFilter falls back to it for plain page
// navigations (e.g. a full reload of /student/**), and SecurityConfig
// enforces role checks on those routes at the filter-chain level - removing
// the cookie would silently break that server-side enforcement for the SPA.

const TOKEN_KEY = "token";
const USER_KEY = "user";

export interface StoredUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
}

// Legacy Thymeleaf pages store the session in localStorage ("Remember me") OR
// sessionStorage (not remembered). Both are read - and both cleared on logout -
// so a user can move between legacy and React pages without being logged out.
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: StoredUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  document.cookie = `jwt=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  document.cookie = "jwt=; path=/; max-age=0";
}

export function roleHomePath(role: Role): string {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "TEACHER":
      return "/teacher";
    case "ADMIN":
      return "/admin";
  }
}
