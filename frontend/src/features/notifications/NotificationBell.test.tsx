import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationBell } from "./NotificationBell";
import { notificationApi } from "@/api/notification.api";
import type { NotificationItem } from "@/types/api";

vi.mock("@/api/notification.api", () => ({
  notificationApi: { list: vi.fn(), unreadCount: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn() },
}));

const api = vi.mocked(notificationApi);

function item(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 1,
    title: "Quiz assigned",
    message: "A new quiz is waiting",
    type: "QUIZ_ASSIGNED",
    read: false,
    link: "/student/history",
    createdAt: "2026-09-19T08:30:00",
    ...overrides,
  };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/start"]}>
        <NotificationBell />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const realLocation = window.location;
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  api.unreadCount.mockResolvedValue(2);
  api.markRead.mockResolvedValue(undefined);
  api.markAllRead.mockResolvedValue(undefined);
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("NotificationBell", () => {
  it("exposes the unread count in the button's accessible name", async () => {
    renderBell();
    expect(
      await screen.findByRole("button", { name: "Notifications, 2 unread" }, { timeout: 4000 }),
    ).toBeInTheDocument();
  });

  it("shows loading then the list when opened, and an empty state", async () => {
    api.list.mockResolvedValue([]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole("button", { name: /Notifications/ }));
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("shows an error with retry when the list fails", async () => {
    api.list.mockRejectedValueOnce({ status: 500, message: "boom" }).mockResolvedValue([item({})]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole("button", { name: /Notifications/ }));
    await user.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Quiz assigned")).toBeInTheDocument();
  });

  it("marks the item read, then navigates through the router for a React-owned link", async () => {
    api.list.mockResolvedValue([item({ id: 7, link: "/student/history" })]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole("button", { name: /Notifications/ }));
    await user.click(await screen.findByRole("button", { name: /Quiz assigned/ }));

    expect(api.markRead).toHaveBeenCalledWith(7);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student/history"));
    expect(assign).not.toHaveBeenCalled();
  });

  it("uses a full page load for a link to a still server-rendered page", async () => {
    api.list.mockResolvedValue([item({ link: "/teacher/classrooms/5/members" })]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole("button", { name: /Notifications/ }));
    await user.click(await screen.findByRole("button", { name: /Quiz assigned/ }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/teacher/classrooms/5/members"));
  });

  it.each(["https://evil.example/phish", "//evil.example", "javascript:alert(1)", "data:text/html,x"])(
    "never navigates to an unsafe link (%s)",
    async (link) => {
      api.list.mockResolvedValue([item({ link })]);
      const user = userEvent.setup();
      renderBell();
      await user.click(await screen.findByRole("button", { name: /Notifications/ }));
      await user.click(await screen.findByRole("button", { name: /Quiz assigned/ }));

      await waitFor(() => expect(api.markRead).toHaveBeenCalled());
      expect(assign).not.toHaveBeenCalled();
      expect(screen.getByTestId("where")).toHaveTextContent("/start");
    },
  );

  it("renders notification text as text, never as markup", async () => {
    api.list.mockResolvedValue([item({ title: "<img src=x onerror=alert(1)>", message: "<b>bold</b>" })]);
    const user = userEvent.setup();
    renderBell();
    await user.click(await screen.findByRole("button", { name: /Notifications/ }));

    expect(await screen.findByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("marks all as read and closes with Escape returning focus to the bell", async () => {
    api.list.mockResolvedValue([item({})]);
    const user = userEvent.setup();
    renderBell();
    const bell = await screen.findByRole("button", { name: /Notifications/ });
    await user.click(bell);
    await user.click(await screen.findByRole("button", { name: "Mark all as read" }));
    expect(api.markAllRead).toHaveBeenCalled();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });
});
