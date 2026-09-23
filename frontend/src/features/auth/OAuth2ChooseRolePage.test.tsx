import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2ChooseRolePage } from "./OAuth2ChooseRolePage";
import { AuthProvider } from "@/auth/AuthProvider";
import { authApi } from "@/api/auth.api";
import type { AuthResponse } from "@/types/api";

vi.mock("@/api/auth.api", () => ({
  authApi: { oauth2Register: vi.fn(), login: vi.fn(), register: vi.fn(), checkEmail: vi.fn() },
}));

const api = vi.mocked(authApi);

function b64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(search: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[`/oauth2-choose-role.html${search}`]}>
          <Routes>
            <Route path="/oauth2-choose-role.html" element={<OAuth2ChooseRolePage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function auth(role: AuthResponse["role"]): AuthResponse {
  return { id: 9, email: "ada@example.com", fullName: "Ada Lovelace", role, token: "jwt-token", avatarUrl: null };
}

const good = `?email=ada%40example.com&fullName=${encodeURIComponent(b64("Ada Lovelace"))}&avatarUrl=`;
const realLocation = window.location;
const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, assign } });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("OAuth2ChooseRolePage", () => {
  it("keeps Continue disabled until a role is chosen (real radios, keyboard reachable)", async () => {
    const user = userEvent.setup();
    renderAt(good);

    const continueButton = screen.getByRole("button", { name: "Tiếp tục" });
    expect(continueButton).toBeDisabled();
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /tôi là học viên/i }));
    expect(continueButton).toBeEnabled();
  });

  it("registers as a student, stores the session directly (no token in a URL) and goes to the React dashboard", async () => {
    api.oauth2Register.mockResolvedValue(auth("STUDENT"));
    const user = userEvent.setup();
    renderAt(good);
    await user.click(screen.getByRole("radio", { name: /tôi là học viên/i }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() =>
      expect(api.oauth2Register).toHaveBeenCalledWith({
        email: "ada@example.com",
        fullName: "Ada Lovelace",
        avatarUrl: "",
        role: "STUDENT",
      }),
    );
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student"));
    expect(localStorage.getItem("token")).toBe("jwt-token");
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a new teacher to the still server-rendered dashboard with a full page load", async () => {
    api.oauth2Register.mockResolvedValue(auth("TEACHER"));
    const user = userEvent.setup();
    renderAt(good);
    await user.click(screen.getByRole("radio", { name: /tôi là giáo viên/i }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/teacher"));
  });

  it("shows the server's error as text and lets the user retry", async () => {
    api.oauth2Register.mockRejectedValueOnce({ status: 400, code: 1013, message: "Email đã tồn tại" });
    const user = userEvent.setup();
    renderAt(good);
    await user.click(screen.getByRole("radio", { name: /tôi là học viên/i }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email đã tồn tại");
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeEnabled();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("degrades gracefully when the handoff parameters are missing or malformed", () => {
    renderAt("?fullName=abc");
    expect(screen.getByRole("alert")).toHaveTextContent(/không thể đọc/i);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" })).toHaveAttribute("href", "/login");
  });

  it("renders a hostile name as inert text and never forwards a non-https avatar URL", async () => {
    api.oauth2Register.mockResolvedValue(auth("STUDENT"));
    const hostile = "<img src=x onerror=alert(1)>";
    const user = userEvent.setup();
    renderAt(
      `?email=a%40b.co&fullName=${encodeURIComponent(b64(hostile))}&avatarUrl=${encodeURIComponent("javascript:alert(1)")}`,
    );

    expect(screen.getByText(hostile)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();

    await user.click(screen.getByRole("radio", { name: /tôi là học viên/i }));
    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await waitFor(() => expect(api.oauth2Register).toHaveBeenCalledWith(expect.objectContaining({ avatarUrl: "" })));
  });
});
