import { Navigate } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";

/**
 * Minimal routing shell for "/" - deliberately does not port the legacy
 * marketing landing page's content (index.html/index.css), only the
 * redirect behavior, to keep this sprint's scope on the student vertical
 * slice. See docs/frontend/MIGRATION_PARITY.md.
 */
export function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}
