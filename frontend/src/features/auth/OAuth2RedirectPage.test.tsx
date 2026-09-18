import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { OAuth2RedirectPage } from "./OAuth2RedirectPage";
import { AuthProvider } from "@/auth/AuthProvider";

function renderAt(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/oauth2-redirect.html" element={<OAuth2RedirectPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("OAuth2RedirectPage (F-02 regression)", () => {
  it("renders an HTML-payload error message as inert text, not markup", () => {
    const payload = "<img src=x onerror=alert(1)>";
    renderAt(`/oauth2-redirect.html?error=${encodeURIComponent(payload)}`);

    // The payload must appear as literal visible text...
    expect(screen.getByText(payload)).toBeInTheDocument();
    // ...and must NOT have been parsed into a real <img> element anywhere.
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("shows a friendly message when the callback is missing required params", () => {
    renderAt("/oauth2-redirect.html");
    expect(screen.getByText(/invalid sign-in response/i)).toBeInTheDocument();
  });
});
