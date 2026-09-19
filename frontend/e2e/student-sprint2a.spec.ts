import { randomUUID } from "node:crypto";
import { expect, loginAsStudent, test } from "./support/test";

// Practice note: a practice only draws PUBLIC questions, and the only public ways to create those need an
// ADMIN (approval) which no public API can create (register accepts STUDENT/TEACHER only; the E2E stack starts
// with SQL_INIT_MODE=never). So a full start->answer->submit practice run cannot be seeded through the public
// API here; that flow is covered by the usePracticePlayer / PracticePlayPage / PracticeReviewPage component tests.

test("profile: edit name and phone, reload and see them persisted", async ({ page, world }) => {
  await loginAsStudent(page, world);
  await page.getByRole("link", { name: "Profile" }).first().click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();

  const name = `Renamed ${randomUUID().slice(0, 6)}`;
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Phone number").fill("0912345678");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Full name")).toHaveValue(name);
  await expect(page.getByLabel("Phone number")).toHaveValue("0912345678");
  await expect(page.getByLabel("Email")).toBeDisabled();
});

test("profile: an empty name is rejected before anything is saved", async ({ page, world }) => {
  await loginAsStudent(page, world, "/profile");
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel("Full name").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(page.getByText("Profile saved.")).toHaveCount(0);
});

test("practice setup: opens from the navigation and offers set-up or an empty state, never a crash", async ({
  page,
  world,
}) => {
  await loginAsStudent(page, world);
  await page.getByRole("link", { name: "Practice" }).first().click();
  await expect(page).toHaveURL(/\/student\/practice$/);
  await expect(page.getByRole("heading", { name: "Practice", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Practice history" })).toBeVisible();
});

test("practice history: the Practice tab shows an empty state for a new student and survives reload", async ({
  page,
  world,
}) => {
  await loginAsStudent(page, world, "/student/history?tab=practice");
  await expect(page).toHaveURL(/\/student\/history\?tab=practice$/);
  await expect(page.getByRole("tab", { name: /practice/i })).toHaveAttribute("aria-selected", "true");
  await page.reload();
  await expect(page.getByRole("tab", { name: /practice/i })).toHaveAttribute("aria-selected", "true");
});

test("legacy practice-history URL redirects into the React history tab", async ({ page, world }) => {
  await loginAsStudent(page, world, "/student/practice-history");
  await expect(page).toHaveURL(/\/student\/history\?tab=practice$/);
});

test("practice play without a session sends the student back to set one up", async ({ page, world }) => {
  await loginAsStudent(page, world, "/student/practice/play");
  await expect(page.getByText("No practice in progress")).toBeVisible();
  await page.getByRole("link", { name: "Set up a practice" }).click();
  await expect(page).toHaveURL(/\/student\/practice$/);
});

test("notifications: the assignment notice is unread, opens in an accessible panel and mark-all-read persists", async ({
  page,
  world,
}) => {
  // Assigning the quiz (done by the world, through the public API) notifies the student.
  await loginAsStudent(page, world);
  const bell = page.getByRole("button", { name: /^Notifications, 1 unread$/ });
  await bell.click();
  await expect(bell).toHaveAttribute("aria-expanded", "true");
  const panel = page.getByRole("region", { name: "Notifications" });
  await expect(panel.getByRole("button", { name: /^Unread:/ })).toHaveCount(1);

  await panel.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /^Notifications/ })).toHaveAttribute("aria-expanded", "false");

  await page.reload();
  await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();
});

test.describe("OAuth first-login role choice (no Google involved)", () => {
  function chooseRoleUrl(email: string, name: string) {
    const encoded = Buffer.from(name, "utf-8").toString("base64");
    return `/oauth2-choose-role.html?email=${encodeURIComponent(email)}&fullName=${encodeURIComponent(encoded)}`;
  }

  test("a new Google user picks a role via the public oauth2-register API and lands signed in", async ({ page }) => {
    const email = `oauth-${randomUUID().slice(0, 10)}@e2e.test`;
    await page.goto(chooseRoleUrl(email, "Nguyễn Văn Á"));
    await expect(page.getByRole("heading", { name: "Welcome to QuizHub" })).toBeVisible();
    await expect(page.getByText("Nguyễn Văn Á")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeDisabled();

    await page.getByRole("radio", { name: /i'm a student/i }).check();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("missing or malformed parameters show an error instead of a form", async ({ page }) => {
    await page.goto("/oauth2-choose-role.html?email=not-an-email");
    await expect(page.getByRole("heading", { name: "Sign-in information missing" })).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
  });

  test("the URL name is rendered as text, never as markup", async ({ page }) => {
    const email = `oauth-${randomUUID().slice(0, 10)}@e2e.test`;
    await page.goto(chooseRoleUrl(email, "<img src=x onerror=window.__pwned=1>"));
    await expect(page.getByRole("heading", { name: "Welcome to QuizHub" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });
});
