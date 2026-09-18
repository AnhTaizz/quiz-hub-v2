import { expect, test, type Page } from "@playwright/test";
import { loginAsStudent } from "./support/fixture";

const WIDTHS = [360, 430, 768, 1024, 1440];

async function noHorizontalOverflow(page: Page, label: string, width: number) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${label} @${width}px overflows horizontally`).toBeLessThanOrEqual(clientWidth);
}

test("key student routes have no horizontal overflow from 360px to 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAsStudent(page);

  // Needs an existing attempt for the result page; the journey spec has submitted one.
  const attemptId = await page.evaluate(async () => {
    const token = localStorage.getItem("token") ?? "";
    const response = await fetch("/api/student/quiz/history?page=0&size=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { content: { attemptId: number }[] };
    return body.content[0]?.attemptId;
  });
  expect(attemptId, "expected a submitted attempt from the journey spec").toBeDefined();

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
    // Quiz play (resumes the unfinished attempt started by the keyboard spec, or starts a new one).
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
