import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2RedirectPage, oauth2LoginExchangeState } from "./OAuth2RedirectPage";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { authApi } from "@/api/auth.api";
import { goToSafePath } from "@/utils/routes";
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
  oauth2LoginExchangeState.generation = 0;
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

// ---------- Edge cases: a completed exchange must never be replayed later in the same page load ----------
//
// The real app has ONE QueryClient for the whole page load (src/app/queryClient.ts) and logout() does not
// clear it, so these tests keep a single router tree + client alive and move between routes client-side,
// exactly like in-app navigation does - no remount of the module, no fresh cache.

const USER_A: AuthResponse = { id: 1, email: "a@example.com", fullName: "Google User A", role: "STUDENT", token: "jwt-A", avatarUrl: null };
const USER_B = { id: 2, email: "b@example.com", fullName: "Password User B", role: "STUDENT" as const, avatarUrl: null };
const INVALID_TICKET = { status: 400, code: 1049, message: "invalid" };

function StudentStub() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p data-testid="where">{useLocation().pathname}</p>
      <p data-testid="who">{user?.email ?? "anonymous"}</p>
      <button type="button" onClick={logout}>logout</button>
      <Link to="/login">to login</Link>
      <Link to="/oauth2-redirect.html">revisit callback</Link>
      <Link to={`/oauth2-redirect.html?error=${encodeURIComponent("Tài khoản đã bị khóa")}`}>error callback</Link>
    </div>
  );
}

/** Simulates a plain email/password login whose ?returnUrl= points at the OAuth callback page. */
function LoginStub() {
  const { login } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        login("jwt-B", USER_B);
        goToSafePath("/oauth2-redirect.html", "/student", navigate);
      }}
    >
      password login as B
    </button>
  );
}

function renderApp(path: string, { strict = false }: { strict?: boolean } = {}) {
  const tree = (
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/oauth2-redirect.html" element={<OAuth2RedirectPage />} />
            <Route path="/student" element={<StudentStub />} />
            <Route path="/login" element={<LoginStub />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

async function completeGoogleLoginAsA() {
  await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student"));
  expect(localStorage.getItem("token")).toBe("jwt-A");
}

describe("OAuth2RedirectPage - a completed exchange is never replayed within the same page load", () => {
  it("does not restore a logged-out session when the callback page is revisited client-side with no new ticket", async () => {
    api.oauth2Login.mockResolvedValueOnce(USER_A).mockRejectedValue(INVALID_TICKET);
    const user = userEvent.setup();
    renderApp("/oauth2-redirect.html");
    await completeGoogleLoginAsA();

    await user.click(screen.getByRole("button", { name: "logout" }));
    expect(localStorage.getItem("token")).toBeNull();

    await user.click(screen.getByRole("link", { name: "revisit callback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/hết hạn hoặc không hợp lệ/i);
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.queryByTestId("who")).not.toBeInTheDocument();
  });

  it("does not replace a different user's password-login session with a stale Google exchange result", async () => {
    api.oauth2Login.mockResolvedValueOnce(USER_A).mockRejectedValue(INVALID_TICKET);
    const user = userEvent.setup();
    renderApp("/oauth2-redirect.html");
    await completeGoogleLoginAsA();

    await user.click(screen.getByRole("button", { name: "logout" }));
    await user.click(screen.getByRole("link", { name: "to login" }));
    await user.click(screen.getByRole("button", { name: "password login as B" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/hết hạn hoặc không hợp lệ/i);
    expect(localStorage.getItem("token")).toBe("jwt-B");
    expect(JSON.parse(localStorage.getItem("user") ?? "null")?.email).toBe("b@example.com");
  });

  it("never logs in from cached exchange data when the callback route carries ?error=", async () => {
    api.oauth2Login.mockResolvedValueOnce(USER_A).mockRejectedValue(INVALID_TICKET);
    const user = userEvent.setup();
    renderApp("/oauth2-redirect.html");
    await completeGoogleLoginAsA();

    await user.click(screen.getByRole("button", { name: "logout" }));
    await user.click(screen.getByRole("link", { name: "error callback" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản đã bị khóa");
    expect(localStorage.getItem("token")).toBeNull();
    expect(screen.queryByTestId("who")).not.toBeInTheDocument();
    // An error callback must never exchange a ticket either.
    expect(api.oauth2Login).toHaveBeenCalledTimes(1);
  });

  it("under real <StrictMode>, one callback exchanges exactly once and signs the user in", async () => {
    api.oauth2Login.mockResolvedValueOnce(USER_A).mockRejectedValue(INVALID_TICKET);
    renderApp("/oauth2-redirect.html", { strict: true });

    await completeGoogleLoginAsA();
    expect(screen.getByTestId("who")).toHaveTextContent("a@example.com");
    expect(api.oauth2Login).toHaveBeenCalledTimes(1);
  });
});
