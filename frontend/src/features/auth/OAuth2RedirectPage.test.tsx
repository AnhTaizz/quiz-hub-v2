import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2RedirectPage, oauth2LoginExchangeState } from "./OAuth2RedirectPage";
import { AuthProvider } from "@/auth/AuthProvider";
import { authApi } from "@/api/auth.api";
import type { AuthResponse } from "@/types/api";

vi.mock("@/api/auth.api", () => ({
  authApi: { oauth2Login: vi.fn() },
}));

const api = vi.mocked(authApi);

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string, queryClient: QueryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/oauth2-redirect.html" element={<OAuth2RedirectPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function auth(): AuthResponse {
  return { id: 9, email: "ada@example.com", fullName: "Ada Lovelace", role: "STUDENT", token: "jwt-token", avatarUrl: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // The single-flight promise cache is deliberately module-scoped (see OAuth2RedirectPage.tsx) so it
  // survives a real StrictMode-style remount within one page load - reset it here so each test case
  // gets a clean slate.
  oauth2LoginExchangeState.promise = null;
});

afterEach(() => {
  localStorage.clear();
});

describe("OAuth2RedirectPage (F-02 regression + existing-user ticket exchange)", () => {
  it("renders an HTML-payload error message as inert text, not markup", () => {
    const payload = "<img src=x onerror=alert(1)>";
    renderAt(`/oauth2-redirect.html?error=${encodeURIComponent(payload)}`);

    // The payload must appear as literal visible text...
    expect(screen.getByText(payload)).toBeInTheDocument();
    // ...and must NOT have been parsed into a real <img> element anywhere.
    expect(document.querySelector("img[src='x']")).toBeNull();
    // An error query param must never attempt the ticket exchange.
    expect(api.oauth2Login).not.toHaveBeenCalled();
  });

  it("exchanges the login ticket, stores the session directly (never reading a token from the URL) and goes to the React dashboard", async () => {
    api.oauth2Login.mockResolvedValue(auth());
    renderAt("/oauth2-redirect.html");

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student"));
    expect(localStorage.getItem("token")).toBe("jwt-token");
    expect(api.oauth2Login).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly, translated error and a way back to login when the exchange fails (missing/expired/invalid ticket)", async () => {
    api.oauth2Login.mockRejectedValue({ status: 400, code: 1049, message: "invalid" });
    renderAt("/oauth2-redirect.html");

    expect(await screen.findByRole("alert")).toHaveTextContent(/hết hạn hoặc không hợp lệ/i);
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" })).toHaveAttribute("href", "/login");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("never calls the exchange endpoint twice for one mount, even under a StrictMode-style remount", async () => {
    api.oauth2Login.mockResolvedValue(auth());
    // React 18 StrictMode's dev-only mount -> unmount -> remount cycle keeps the QueryClient instance
    // alive across it (it lives outside component state, not recreated on remount) - only the component
    // subscribing to the query double-mounts. Reusing one client across an unmount+re-render is the
    // faithful way to simulate that here.
    const queryClient = new QueryClient();
    const { unmount } = renderAt("/oauth2-redirect.html", queryClient);
    unmount();
    renderAt("/oauth2-redirect.html", queryClient);

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student"));
    expect(api.oauth2Login).toHaveBeenCalledTimes(1);
  });
});
