import { isSafeInternalPath } from "@/utils/safePath";
import { isReactRoute } from "@/utils/routes";

export type NotificationTarget =
  | { kind: "none" }
  | { kind: "react"; path: string }
  | { kind: "server"; path: string };

/**
 * Notification links are server-generated today, but they are stored data and are treated as untrusted:
 * only a same-origin relative path is ever followed (no absolute URLs, no protocol-relative "//host",
 * no javascript:/data:). React-owned paths use the client router; paths for pages that are still
 * server-rendered (teacher/admin/legacy student) need a full page load.
 */
export function resolveNotificationTarget(link: string | null | undefined): NotificationTarget {
  if (!isSafeInternalPath(link)) return { kind: "none" };
  return isReactRoute(link) ? { kind: "react", path: link } : { kind: "server", path: link };
}
