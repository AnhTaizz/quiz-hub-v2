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

// OAuth first-login role choice previously had E2E coverage here that drove
// /oauth2-choose-role.html directly with ?email=&fullName= query parameters and called the (at the time)
// public POST /api/auth/oauth2-register with a client-supplied email - i.e. it exercised the exact
// unauthenticated-account-creation defect fixed in this sprint (see
// docs/backend/OAUTH2_REGISTRATION_SECURITY.md) as if it were a legitimate flow.
//
// Registration now requires a real Google OAuth2 callback: the backend only ever sets the
// oauth2_reg_ticket cookie itself, and this E2E suite deliberately has no test-only endpoint or DB access
// to mint one (see e2e/support/api.ts). Driving this flow here would require a real Google test account,
// which the task this fix was made under explicitly excludes. The page-level behavior (disabled Continue
// until a role is picked, the request sending only {role}, error display, the "no valid pending
// registration" error state, and hostile-name-as-text rendering) is instead covered by
// src/features/auth/OAuth2ChooseRolePage.test.tsx, which mocks GET /auth/oauth2-register/pending and POST
// /auth/oauth2-register the way a real ticket-bound session would respond.
