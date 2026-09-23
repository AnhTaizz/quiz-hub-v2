import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { NotificationItem } from "@/types/api";
import { formatDateTime } from "@/utils/format";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { resolveNotificationTarget } from "./notificationLink";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from "./useNotifications";
import "./NotificationBell.css";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const unread = useUnreadCount();
  const list = useNotificationList(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const count = unread.data ?? 0;

  // Escape closes (focus returns to the bell); a click outside closes.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      try {
        await markRead.mutateAsync(item.id);
      } catch {
        // A failed mark-read must not trap the user: still follow the link (the list refetches either way).
      }
    }
    setOpen(false);
    const target = resolveNotificationTarget(item.link);
    if (target.kind === "react") navigate(target.path);
    else if (target.kind === "server") window.location.assign(target.path);
  }

  const label = count > 0 ? `Thông báo, ${count} chưa đọc` : "Thông báo";

  return (
    <div className="qh-bell" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        className="qh-bell__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.7V3a2 2 0 1 0-4 0v1.3A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z" />
        </svg>
        {count > 0 && (
          <span className="qh-bell__badge" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div id={panelId} className="qh-bell__panel" role="region" aria-label="Thông báo">
          <div className="qh-bell__panel-header">
            <h2 className="qh-bell__title">Thông báo</h2>
            <button
              type="button"
              className="qh-bell__mark-all"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending || count === 0}
            >
              Đánh dấu đã đọc tất cả
            </button>
          </div>

          {list.isLoading && <Spinner label="Đang tải thông báo" />}
          {list.isError && <ErrorState message="Không thể tải thông báo." onRetry={() => void list.refetch()} />}
          {list.data && list.data.length === 0 && <EmptyState title="Chưa có thông báo" />}

          {list.data && list.data.length > 0 && (
            <ul className="qh-bell__list">
              {list.data.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`qh-bell__item ${item.read ? "" : "qh-bell__item--unread"}`}
                    onClick={() => void handleItemClick(item)}
                  >
                    {!item.read && <span className="visually-hidden">Chưa đọc: </span>}
                    <span className="qh-bell__item-title">{item.title}</span>
                    <span className="qh-bell__item-message">{item.message}</span>
                    <span className="qh-bell__item-time">{formatDateTime(item.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
