import type { Page } from "@playwright/test";

export interface E2EFixture {
  student: { email: string; password: string };
  quizTitle: string;
  assigningId: number;
}

/** Populated once by global-setup.ts (through the real REST API) and shared with every worker via env. */
export function getFixture(): E2EFixture {
  const raw = process.env.E2E_FIXTURE;
  if (!raw) throw new Error("E2E_FIXTURE missing - global-setup did not run");
  return JSON.parse(raw) as E2EFixture;
}

export async function loginAsStudent(page: Page, returnUrl?: string): Promise<void> {
  const { student } = getFixture();
  await page.goto(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login");
  await page.getByLabel("Email").fill(student.email);
  await page.getByLabel("Password", { exact: true }).fill(student.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Don't return mid-login: callers navigate next, which would abort the in-flight sign-in request.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
