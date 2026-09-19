import { resolveSafeReturnPath } from "./safePath";

// Paths owned by the React SPA (mirror of SpaController's allow-list). Anything else - /teacher/**, /admin/**,
// /student/categories, the legacy personal-quiz pages - is still server-rendered and needs a full page load:
// handing it to React Router would render nothing.
const REACT_PATHS: RegExp[] = [
  /^\/$/,
  /^\/login$/,
  /^\/register$/,
  /^\/forgot-password$/,
  /^\/oauth2-redirect\.html$/,
  /^\/oauth2-choose-role\.html$/,
  /^\/profile$/,
  /^\/student$/,
  /^\/student\/(quizzes|classrooms|history|practice|practice\/play|practice-history)$/,
  /^\/student\/classrooms\/\d+$/,
  /^\/student\/practice\/review\/\d+$/,
  /^\/student\/quiz\/(play|resume|result)\/\d+$/,
];

export function isReactRoute(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  return REACT_PATHS.some((pattern) => pattern.test(pathname));
}

export type NavigateFn = (to: string, options?: { replace?: boolean }) => void;

/**
 * Sends the user to a same-origin path, choosing the right mechanism: React Router for React-owned routes,
 * a full page load (window.location.assign) for everything still rendered by the server. The target is
 * validated first; an unsafe or missing value falls back to `fallback`.
 */
export function goToSafePath(
  target: string | null | undefined,
  fallback: string,
  navigate: NavigateFn,
  assign: (url: string) => void = (url) => window.location.assign(url),
): void {
  const path = resolveSafeReturnPath(target, fallback);
  if (isReactRoute(path)) {
    navigate(path, { replace: true });
  } else {
    assign(path);
  }
}
