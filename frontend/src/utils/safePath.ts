/**
 * Guards the post-login `returnUrl` redirect (fixes audit finding F-03: the
 * legacy static/js/login.js sent `window.location.href =
 * decodeURIComponent(returnUrl)` with no validation, an open-redirect
 * pattern). The backend's JwtAuthenticationEntryPoint itself constructs
 * `/login?returnUrl=<original request URI>` for an unauthenticated page hit
 * (see src/main/java/.../security/JwtAuthenticationEntryPoint.java), so a
 * real `returnUrl` value is always a relative, same-origin path - anything
 * else is either an attacker-crafted link or a malformed value, and must be
 * rejected rather than followed.
 *
 * A path is accepted only if it starts with a single "/" (not "//", which
 * browsers treat as a protocol-relative, cross-origin URL) and contains no
 * scheme (e.g. "javascript:", "https:"). Backslashes are also rejected since
 * some browsers normalize "/\evil.com" the same way as "//evil.com".
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  // A scheme (e.g. "javascript:alert(1)//") could still smuggle itself in
  // after a leading "/" in some parsers; reject any colon before the first
  // "/", "?" or "#".
  const schemeBoundary = path.search(/[/?#]/);
  const beforeBoundary = schemeBoundary === -1 ? path : path.slice(0, schemeBoundary);
  if (beforeBoundary.includes(":")) return false;
  return true;
}

export function resolveSafeReturnPath(
  returnUrl: string | null | undefined,
  fallback: string,
): string {
  return isSafeInternalPath(returnUrl) ? returnUrl : fallback;
}
