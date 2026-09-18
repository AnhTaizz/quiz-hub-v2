import { expect, loginAsStudent, test } from "./support/test";

function originPattern(baseURL: string | undefined, path: string): RegExp {
  const escaped = (baseURL ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}${path}$`);
}

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

  test("an internal returnUrl is honoured after login", async ({ page, world }) => {
    await loginAsStudent(page, world, "/student/quizzes");
    await expect(page).toHaveURL(/\/student\/quizzes$/);
  });

  test("an external returnUrl is ignored after login (open-redirect regression)", async ({ page, world, baseURL }) => {
    await loginAsStudent(page, world, "https://evil.example/phish");
    await expect(page).toHaveURL(originPattern(baseURL, "/student"));
  });

  test("a protocol-relative returnUrl is ignored after login", async ({ page, world, baseURL }) => {
    await loginAsStudent(page, world, "//evil.example");
    await expect(page).toHaveURL(originPattern(baseURL, "/student"));
  });

  test("an OAuth error is displayed as inert text, never executed (F-02 regression)", async ({ page }) => {
    const payload = '<img src=x onerror="window.__pwned=1">';
    await page.goto(`/oauth2-redirect.html?error=${encodeURIComponent(payload)}`);

    await expect(page.getByText(payload)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("logging out returns the user to a protected-route login redirect", async ({ page, world }) => {
    await loginAsStudent(page, world);
    await expect(page).toHaveURL(/\/student$/);
    await page.getByRole("button", { name: "Log out" }).click();
    await page.goto("/student");
    await expect(page).toHaveURL(/\/login/);
  });
});
