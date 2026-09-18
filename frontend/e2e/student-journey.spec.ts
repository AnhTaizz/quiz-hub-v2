import { expect, test } from "@playwright/test";
import { getFixture, loginAsStudent } from "./support/fixture";

test("student core journey: dashboard -> start -> answer -> autosave -> reload restores -> submit -> result", async ({
  page,
}) => {
  const { quizTitle } = getFixture();

  // Login + dashboard
  await loginAsStudent(page);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: quizTitle })).toBeVisible();

  // Start the quiz
  await page.getByRole("link", { name: /start quiz|resume quiz/i }).first().click();
  await expect(page).toHaveURL(/\/student\/quiz\/play\/\d+$/);
  await expect(page.getByRole("timer")).toBeVisible();

  // Question 1 is the single-choice question: pick an answer and wait for the autosave indicator
  await page.getByRole("radio").first().check();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Reload: the answer must be restored (server state + local recovery reconciliation)
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeChecked();

  // Go to the fill-in question and answer it (debounced autosave)
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Your answer").fill("Paris");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Submit through the confirmation dialog
  await page.getByRole("button", { name: "Submit quiz" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Submit", exact: true }).click();

  // Result page
  await expect(page).toHaveURL(/\/student\/quiz\/result\/\d+$/);
  await expect(page.getByText("Correct", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: getFixture().quizTitle })).toBeVisible();
});

test("keyboard-only: quiz answer, modal open/close with Escape and focus return", async ({ page }) => {
  await loginAsStudent(page);
  await page.goto("/student/quizzes");
  await page.getByRole("link", { name: /start quiz|resume quiz/i }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/student\/quiz\/play\/\d+$/);

  // Answer with the keyboard
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio").first()).toBeChecked();

  // Open the submit dialog from the last question, close with Escape, focus returns to the trigger
  await page.getByRole("button", { name: "Next" }).click();
  const trigger = page.getByRole("button", { name: "Submit quiz" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
