import {
  answerCurrentQuestion,
  expect,
  expectAnswerRestored,
  loginAsStudent,
  showChoiceQuestion,
  showLastQuestion,
  test,
} from "./support/test";

test("student core journey: dashboard -> start -> answer -> autosave -> reload restores -> submit -> result", async ({
  page,
  world,
}) => {
  // Login + dashboard
  await loginAsStudent(page, world);
  await expect(page).toHaveURL(/\/student$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: world.quizTitle })).toBeVisible();

  // Start the quiz
  await page.locator(".qh-task-card__actions").getByRole("link", { name: /làm bài|tiếp tục/i }).first().click();
  await expect(page).toHaveURL(/\/student\/quiz\/play\/\d+$/);
  await expect(page.getByRole("timer")).toBeVisible();

  // Answer whichever question is first (question order is not guaranteed) and wait for the autosave indicator
  const firstKind = await answerCurrentQuestion(page);

  // Reload: the answer must be restored (server state + local recovery reconciliation)
  await page.reload();
  await expectAnswerRestored(page, firstKind);

  // Answer the other question (a reload always returns to question 1)
  await page.getByRole("button", { name: "Câu tiếp" }).click();
  await expect(page.getByText(/^Câu 2 \/ \d+$/)).toBeVisible();
  await answerCurrentQuestion(page);

  // Submit through the confirmation dialog
  await page.getByRole("button", { name: "Nộp bài thi" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Nộp bài", exact: true }).click();

  // Result page
  await expect(page).toHaveURL(/\/student\/quiz\/result\/\d+$/);
  await expect(page.getByText("Chính xác", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: world.quizTitle })).toBeVisible();
});

test("keyboard-only: quiz answer, modal open/close with Escape and focus return", async ({ page, world }) => {
  await loginAsStudent(page, world);
  await page.goto("/student/quizzes");
  await page.locator(".qh-quiz-card__action").getByRole("link", { name: /làm bài|tiếp tục/i }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/student\/quiz\/play\/\d+$/);

  // Answer the single-choice question with the keyboard (wherever it is in the quiz)
  await showChoiceQuestion(page);
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio").first()).toBeChecked();

  // Open the submit dialog from the last question, close with Escape, focus returns to the trigger
  await showLastQuestion(page);
  const trigger = page.getByRole("button", { name: "Nộp bài thi" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
