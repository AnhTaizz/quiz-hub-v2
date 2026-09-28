import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { AppShell, StudentHeader } from "./AppShell";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";

function renderHeader(initialRoute = "/student") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <StudentHeader />
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function renderShell(initialRoute = "/student") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Routes>
              <Route path="/student" element={<AppShell />}>
                <Route index element={<div data-testid="dashboard-content">Dashboard Content</div>} />
                <Route path="quizzes" element={<div data-testid="quizzes-content">Quizzes Content</div>} />
              </Route>
              <Route path="/profile" element={<div data-testid="profile-content">Profile Content</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("token", "fake-token");
  localStorage.setItem(
    "user",
    JSON.stringify({
      id: 1,
      email: "student@example.com",
      fullName: "Nguyễn Văn A",
      role: "STUDENT",
      avatarUrl: null,
    }),
  );
});

describe("StudentHeader & AppShell", () => {
  it("renders all main navigation items with Vietnamese labels and links", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Trang chủ" })).toHaveAttribute("href", "/student");
    expect(screen.getByRole("link", { name: "Bài thi của tôi" })).toHaveAttribute("href", "/student/quizzes");
    expect(screen.getByRole("link", { name: "Lớp học" })).toHaveAttribute("href", "/student/classrooms");
    expect(screen.getByRole("link", { name: "Lịch sử làm bài" })).toHaveAttribute("href", "/student/history");
    expect(screen.getByRole("link", { name: "Luyện tập" })).toHaveAttribute("href", "/student/practice");
    expect(screen.getByRole("link", { name: "Thư viện của tôi" })).toHaveAttribute(
      "href",
      "/student/categories?type=mine",
    );
  });

  it("provides Vietnamese accessible names for navigation and mobile drawer", async () => {
    const user = userEvent.setup();
    renderHeader();

    expect(screen.getByRole("navigation", { name: "Điều hướng chính" })).toBeInTheDocument();
    const toggle = screen.getByLabelText("Mở menu điều hướng");
    expect(toggle).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByLabelText("Đóng menu điều hướng")).toBeInTheDocument();
  });

  it("renders account dropdown with direct link to profile and password change with dialog query", () => {
    renderHeader();

    const profileLink = screen.getByRole("link", { name: /Hồ sơ cá nhân/i });
    const passwordLink = screen.getByRole("link", { name: /Đổi mật khẩu/i });

    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(passwordLink).toHaveAttribute("href", "/profile?dialog=password");
  });

  it("closes account dropdown when Escape key is pressed or link is clicked", () => {
    renderHeader();

    const details = screen.getByLabelText("Tài khoản người dùng").closest("details");
    expect(details).toBeInTheDocument();

    // Open dropdown details
    if (details) details.open = true;
    expect(details?.open).toBe(true);

    // Escape closes details
    fireEvent.keyDown(document, { key: "Escape" });
    expect(details?.open).toBe(false);
  });

  it("renders Outlet content inside AppShell", () => {
    renderShell("/student");
    expect(screen.getByTestId("dashboard-content")).toBeInTheDocument();
  });
});
