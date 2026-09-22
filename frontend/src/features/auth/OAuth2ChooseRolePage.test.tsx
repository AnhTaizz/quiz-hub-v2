import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2ChooseRolePage } from "./OAuth2ChooseRolePage";
import { AuthProvider } from "@/auth/AuthProvider";
import { authApi } from "@/api/auth.api";
import type { AuthResponse, OAuth2PendingRegistration } from "@/types/api";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    oauth2Register: vi.fn(),
    getPendingOAuth2Registration: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    checkEmail: vi.fn(),
  },
}));

const api = vi.mocked(authApi);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={["/oauth2-choose-role.html"]}>
          <Routes>
            <Route path="/oauth2-choose-role.html" element={<OAuth2ChooseRolePage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function pending(overrides: Partial<OAuth2PendingRegistration> = {}): OAuth2PendingRegistration {
  return { email: "ada@example.com", fullName: "Ada Lovelace", avatarUrl: null, ...overrides };
}

function auth(role: AuthResponse["role"]): AuthResponse {
  return { id: 9, email: "ada@example.com", fullName: "Ada Lovelace", role, token: "jwt-token", avatarUrl: null };
}

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
    api.getPendingOAuth2Registration.mockResolvedValue(pending());
    const user = userEvent.setup();
    renderPage();

    const continueButton = await screen.findByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /i'm a student/i }));
    expect(continueButton).toBeEnabled();
  });

  it("registers as a student sending only the chosen role, stores the session directly (no token in a URL) and goes to the React dashboard", async () => {
    api.getPendingOAuth2Registration.mockResolvedValue(pending());
    api.oauth2Register.mockResolvedValue(auth("STUDENT"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("radio", { name: /i'm a student/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(api.oauth2Register).toHaveBeenCalledWith({ role: "STUDENT" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student"));
    expect(localStorage.getItem("token")).toBe("jwt-token");
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a new teacher to the still server-rendered dashboard with a full page load", async () => {
    api.getPendingOAuth2Registration.mockResolvedValue(pending());
    api.oauth2Register.mockResolvedValue(auth("TEACHER"));
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("radio", { name: /i'm a teacher/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/teacher"));
  });

  it("shows the server's error as text and lets the user retry", async () => {
    api.getPendingOAuth2Registration.mockResolvedValue(pending());
    api.oauth2Register.mockRejectedValueOnce({ status: 400, code: 1013, message: "Email đã tồn tại" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("radio", { name: /i'm a student/i }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email đã tồn tại");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("degrades gracefully when there is no valid pending registration (missing/expired ticket)", async () => {
    api.getPendingOAuth2Registration.mockRejectedValue({ status: 400, code: 1047, message: "Expired" });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not read/i);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login");
  });

  it("renders a hostile name as inert text - it is data from our own backend, never markup", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    api.getPendingOAuth2Registration.mockResolvedValue(pending({ fullName: hostile }));
    api.oauth2Register.mockResolvedValue(auth("STUDENT"));
    renderPage();

    expect(await screen.findByText(hostile)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });
});
