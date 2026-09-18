import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { clearSession, getStoredUser, getToken, setSession, type StoredUser } from "./authStorage";
import { setUnauthorizedHandler } from "@/api/httpClient";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: StoredUser) => void;
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

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
