import { expect, loginAsStudent, showChoiceQuestion, test } from "./support/test";
import type { Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${label}: horizontal overflow at 360px`).toBeLessThanOrEqual(overflow.clientWidth);
}

test.describe("360 x 800 viewport", () => {
  test("login page has no horizontal overflow", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page, "login");
  });

  test("dashboard, quiz list, history and quiz play have no horizontal overflow", async ({ page, world }) => {
    // Own submitted attempt so the history page is populated, plus a startable quiz for the play check.
    await world.seedSubmittedAttempt();
    await loginAsStudent(page, world);
    await expect(page).toHaveURL(/\/student$/);
    await expectNoHorizontalOverflow(page, "dashboard");

    await page.goto("/student/quizzes");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page, "quiz list");

    await page.goto("/student/history");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(world.quizTitle)).toBeVisible();
    await expectNoHorizontalOverflow(page, "history");

    await page.goto("/student/quizzes");
    await page.locator(".qh-quiz-card__action").getByRole("link", { name: /làm bài|tiếp tục/i }).first().click();
    await expect(page.getByRole("timer")).toBeVisible();
    await expectNoHorizontalOverflow(page, "quiz play");

    // Tap targets: every answer option and nav button is at least 40px tall (the single-choice question
    // may be anywhere in the quiz, so navigate to it first).
    await showChoiceQuestion(page);
    const option = page.locator(".qh-quiz-play__option").first();
    const box = await option.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    const nav = page.locator(".qh-quiz-play__nav-dot").first();
    expect((await nav.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
  });
});
