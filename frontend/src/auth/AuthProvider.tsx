import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSession, getStoredUser, getToken, setSession, setStoredUser, type StoredUser } from "./authStorage";
import { setUnauthorizedHandler } from "@/api/httpClient";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: StoredUser) => void;
  /** Merge profile edits (name/avatar) into the signed-in user without touching the token. */
  updateUser: (patch: Partial<Pick<StoredUser, "fullName" | "avatarUrl">>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(() => (getToken() ? getStoredUser() : null));

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  const login = useCallback((token: string, nextUser: StoredUser) => {
    setSession(token, nextUser);
    setUser(nextUser);
  }, []);

  const updateUser = useCallback((patch: Partial<Pick<StoredUser, "fullName" | "avatarUrl">>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      setStoredUser(next);
      return next;
    });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout, updateUser }),
    [user, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
