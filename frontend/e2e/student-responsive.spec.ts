import { expect, loginAsStudent, test } from "./support/test";
import type { Page } from "@playwright/test";

const WIDTHS = [360, 430, 768, 1024, 1440];

async function noHorizontalOverflow(page: Page, label: string, width: number) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label} @${width}px overflows horizontally`).toBeLessThanOrEqual(clientWidth);
}

test("key student routes have no horizontal overflow from 360px to 1440px", async ({ page, world }) => {
  // This test builds everything it needs itself: its own student + startable assignment (`world`), and its
  // own submitted attempt (created through the public API) for the result route.
  const attemptId = await world.seedSubmittedAttempt();

  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAsStudent(page, world);

  const routes: [string, string][] = [
    ["dashboard", "/student"],
    ["quiz list", "/student/quizzes"],
    ["classrooms", "/student/classrooms"],
    ["history", "/student/history"],
    ["result", `/student/quiz/result/${attemptId}`],
  ];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const [label, path] of routes) {
      await page.goto(path);
      await expect(page.locator("h1, h2").first()).toBeVisible();
      await noHorizontalOverflow(page, label, width);
    }
    // Quiz play: the world's assignment is startable (1 of 3 attempts used by the seed above); after the first
    // width the unfinished attempt this loop started is simply resumed.
    await page.goto("/student/quizzes");
    await page.getByRole("link", { name: /start quiz|resume quiz/i }).first().click();
    await expect(page.getByRole("timer")).toBeVisible();
    await noHorizontalOverflow(page, "quiz play", width);
  }

  // Public pages at every width, logged out.
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await noHorizontalOverflow(page, "login", width);
  }
});
