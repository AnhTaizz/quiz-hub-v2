import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api";
import { useAuth } from "@/auth/AuthProvider";
import { roleHomePath } from "@/auth/authStorage";
import { goToSafePath } from "@/utils/routes";
import { Spinner } from "@/components/ui/Spinner";
import { PublicHeader } from "./PublicHeader";
import "./AuthPages.css";

/**
 * Fixes audit finding F-02 (the legacy static/oauth2-redirect.html read `error` from the query string and
 * injected it into the DOM via innerHTML - a reflected DOM-XSS vector; React renders it as a plain text
 * node below, never markup) and a second, separate defect: for an EXISTING user's Google login, this page
 * used to read a real JWT plus id/email/fullName/role/avatarUrl straight off this same query string,
 * because the backend put them there on its server-side redirect. That URL then persisted in browser
 * history, any reverse-proxy/CDN access log that logs query strings, and the Referer header of any
 * subresource request racing the old client-side history.replaceState().
 *
 * The backend redirect here is now bare (no query string at all, error aside): identity travels only via
 * a single-use OAuth2LoginTicket bound to an HttpOnly cookie, which this page exchanges for the real
 * AuthResponse through POST /api/auth/oauth2-login. See docs/backend/OAUTH2_EXISTING_LOGIN_SECURITY.md.
 */
// A ticket is single-use, so the exchange call itself must happen at most once per real page load - not
// once per component mount, and NOT just "at most once per query cache entry": TanStack Query aborts an
// in-flight queryFn when a query's last observer unmounts, and React 18 StrictMode's dev-only mount ->
// unmount -> remount cycle runs synchronously, before that abort can race a real resolution. So the
// remounted (surviving) observer sees an aborted, not "still fetching" or "resolved", query and would
// legitimately start a fresh queryFn call under useQuery's normal rules - and a naive "only start once,
// ever" guard is actively wrong here, because it would also block that second, SURVIVING mount from ever
// completing the exchange at all (verified empirically - see this file's git history for the broken
// version and OAuth2RedirectPage.test.tsx for the regression test that caught it).
//
// The fix is a manual single-flight PROMISE cache at module scope, deliberately outside both React state
// (destroyed on real unmount) and TanStack Query's own cancellation bookkeeping (which is what caused the
// problem above): once the underlying authApi.oauth2Login() call is dispatched, every mount within the
// same page load - aborted-and-discarded or the one that survives - awaits that exact same promise rather
// than ever calling it again, so the survivor still receives the real result once it settles regardless
// of what happened to the mount that started it.
//
// A settled exchange is spent: its result belongs to the one callback that produced it and must never be
// handed to a later mount in the same page load (the app keeps one QueryClient per page load and logout()
// does not clear it). Otherwise a client-side revisit of this route - after logout, or after a different
// user signs in with a password and returnUrl points here - would replay the old Google user's JWT.
// Settlement therefore clears the promise and bumps `generation`; each mount captures the generation it
// started in and keys its query by it, so the StrictMode double-mount of ONE callback (both mounts render
// before anything settles) still shares one key and one promise, while any later mount gets a fresh key
// with no cached data and asks the server again (which, with no new ticket, answers 400).
//
// Exported as an object (not bare module `let`s) only so OAuth2RedirectPage.test.tsx can reset it between
// otherwise-independent test cases within one module lifetime; nothing else should read or write it.
export const oauth2LoginExchangeState: {
  promise: ReturnType<typeof authApi.oauth2Login> | null;
  generation: number;
} = {
  promise: null,
  generation: 0,
};

function exchangeOAuth2LoginOnce() {
  if (!oauth2LoginExchangeState.promise) {
    const promise = authApi.oauth2Login();
    const spend = () => {
      if (oauth2LoginExchangeState.promise !== promise) return;
      oauth2LoginExchangeState.promise = null;
      oauth2LoginExchangeState.generation += 1;
    };
    // then(spend, spend), not finally(): finally() would create a second, unhandled rejecting promise.
    promise.then(spend, spend);
    oauth2LoginExchangeState.promise = promise;
  }
  return oauth2LoginExchangeState.promise;
}

export function OAuth2RedirectPage() {
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get("error");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [generation] = useState(() => oauth2LoginExchangeState.generation);

  const exchange = useQuery({
    queryKey: ["auth", "oauth2-login-exchange", generation],
    // No AbortSignal forwarded on purpose: this call must never be cancelled mid-flight once dispatched -
    // there would be no way to know whether the ticket got consumed server-side before the abort landed.
    queryFn: exchangeOAuth2LoginOnce,
    enabled: !errorParam,
    retry: false,
    staleTime: Infinity,
    // The cached value is a live JWT - drop it as soon as nothing is observing it.
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    // An error callback must never sign anyone in, even if an exchange result is somehow on hand.
    if (errorParam || !exchange.data) return;
    const auth = exchange.data;
    login(auth.token, {
      id: auth.id,
      email: auth.email,
      fullName: auth.fullName,
      role: auth.role,
      avatarUrl: auth.avatarUrl,
    });
    goToSafePath(null, roleHomePath(auth.role), navigate);
  }, [errorParam, exchange.data, login, navigate]);

  if (errorParam) {
    return (
      <div className="qh-auth-page">
        <PublicHeader />
        <div className="qh-auth-card">
          <h1 className="qh-auth-title">Đăng nhập thất bại</h1>
          <p className="qh-auth-error" role="alert">
            {errorParam}
          </p>
          <div className="qh-auth-links">
            <Link to="/login">Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>
    );
  }

  if (exchange.isError) {
    return (
      <div className="qh-auth-page">
        <PublicHeader />
        <div className="qh-auth-card">
          <h1 className="qh-auth-title">Đăng nhập thất bại</h1>
          <p className="qh-auth-error" role="alert">
            Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.
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
