import { expect, loginAsStudent, test } from "./support/test";
import type { Page } from "@playwright/test";

/**
 * Deterministic helper to stabilize rendering before visual snapshots:
 * - Disables CSS animations, transitions, and carets.
 * - Forces font-smoothing.
 */
async function stabilizePageForScreenshot(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Visual Regression - Public & Auth", () => {
  test("login page desktop & mobile snapshots", async ({ page }) => {
    // Desktop viewport (1440x900)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("login-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });

    // Mobile viewport (390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("login-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });
  });
});

test.describe("Visual Regression - Student AppShell & Pages", () => {
  test("student pages desktop & mobile visual regression snapshots", async ({ page, world }) => {
    await world.seedSubmittedAttempt();
    await loginAsStudent(page, world);

    // ==========================================
    // 1. Student Dashboard
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/student");
    await expect(page).toHaveURL(/\/student$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("student-dashboard-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-task-card__chip--due"), page.locator(".qh-dashboard__recent-time")],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("student-dashboard-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-task-card__chip--due"), page.locator(".qh-dashboard__recent-time")],
    });

    // ==========================================
    // 2. Student Quiz List
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/student/quizzes");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("student-quiz-list-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-quiz-card__deadline")],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("student-quiz-list-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-quiz-card__deadline")],
    });

    // ==========================================
    // 3. Student Classroom List
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/student/classrooms");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("student-classroom-list-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-classroom-card__footer")],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("student-classroom-list-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-classroom-card__footer")],
    });

    // ==========================================
    // 4. Student History
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/student/history");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("student-history-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-history-card__meta time")],
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("student-history-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      mask: [page.locator(".qh-history-card__meta time")],
    });

    // ==========================================
    // 5. Student Practice Setup
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/student/practice");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("student-practice-setup-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("student-practice-setup-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });

    // ==========================================
    // 6. User Profile
    // ==========================================
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Hồ sơ cá nhân" })).toBeVisible();
    await stabilizePageForScreenshot(page);

    await expect(page).toHaveScreenshot("profile-desktop.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await stabilizePageForScreenshot(page);
    await expect(page).toHaveScreenshot("profile-mobile.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
    });
  });
});
