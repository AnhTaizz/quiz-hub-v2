import { expect, test } from "@playwright/test";
import { loginAsStudent } from "./support/fixture";

test.describe("authentication", () => {
  test("wrong credentials show a friendly error and stay on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated /student redirects to login and preserves the destination", async ({ page }) => {
    await page.goto("/student/quizzes");
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });

  test("an internal returnUrl is honoured after login", async ({ page }) => {
    await loginAsStudent(page, "/student/quizzes");
    await expect(page).toHaveURL(/\/student\/quizzes$/);
  });

  test("an external returnUrl is ignored after login (open-redirect regression)", async ({ page, baseURL }) => {
    await loginAsStudent(page, "https://evil.example/phish");
    await expect(page).toHaveURL(new RegExp(`^${baseURL?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/student$`));
  });

  test("a protocol-relative returnUrl is ignored after login", async ({ page, baseURL }) => {
    await loginAsStudent(page, "//evil.example");
    await expect(page).toHaveURL(new RegExp(`^${baseURL?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/student$`));
  });

  test("an OAuth error is displayed as inert text, never executed (F-02 regression)", async ({ page }) => {
    const payload = "<img src=x onerror=\"window.__pwned=1\">";
    await page.goto(`/oauth2-redirect.html?error=${encodeURIComponent(payload)}`);

    await expect(page.getByText(payload)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("logging out returns the user to a protected-route login redirect", async ({ page }) => {
    await loginAsStudent(page);
    await expect(page).toHaveURL(/\/student$/);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/student");
    await expect(page).toHaveURL(/\/login/);
  });
});
