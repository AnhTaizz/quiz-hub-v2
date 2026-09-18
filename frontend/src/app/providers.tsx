import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { queryClient } from "./queryClient";
import { AuthProvider } from "@/auth/AuthProvider";
import { ToastProvider } from "@/components/feedback/ToastProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  // No basename: Vite's `base: '/app/'` (vite.config.ts) only affects where
  // index.html's own built <script>/<link> asset URLs point. The backend
  // *forwards* (not redirects) React-owned paths like /student/** to that
  // index.html, so the browser's visible URL - and therefore every route
  // below - stays at the real path (e.g. /student/quizzes), not /app/....
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
