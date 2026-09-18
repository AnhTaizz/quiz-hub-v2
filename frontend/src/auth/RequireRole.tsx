import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { Role } from "@/types/api";
import { useAuth } from "./AuthProvider";
import { roleHomePath } from "./authStorage";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return null; // RequireAuth (parent route) handles the unauthenticated case
  if (user.role !== role) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return <>{children}</>;
}
