import { expect, test as base, type Page } from "@playwright/test";
import { createWorld, type World } from "./api";

// `world` is a per-test fixture: Playwright only builds it for tests that ask for it, and builds a
// brand-new one each time, so every test is fully independent and order-free.
export const test = base.extend<{ world: World }>({
  world: async ({ playwright, baseURL }, provide) => {
    const api = await playwright.request.newContext({ baseURL });
    try {
      await provide(await createWorld(api));
    } finally {
      await api.dispose();
    }
  },
});

export { expect };

// The API does not guarantee question order (Quiz.questions is an unordered many-to-many), so a quiz's
// first question may be the single-choice OR the fill-in one. Tests must never assume which.
export type AnswerKind = "choice" | "fill";

async function currentQuestionKind(page: Page): Promise<AnswerKind> {
  await expect(page.getByRole("region", { name: /^Question \d+$/ })).toBeVisible();
  return (await page.getByLabel("Your answer").count()) > 0 ? "fill" : "choice";
}

/** Answers whichever question is currently shown and waits for the autosave indicator. */
export async function answerCurrentQuestion(page: Page): Promise<AnswerKind> {
  const kind = await currentQuestionKind(page);
  if (kind === "fill") {
    await page.getByLabel("Your answer").fill("Paris");
  } else {
    await page.getByRole("radio").first().check();
  }
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  return kind;
}

export async function expectAnswerRestored(page: Page, kind: AnswerKind): Promise<void> {
  if (kind === "fill") {
    await expect(page.getByLabel("Your answer")).toHaveValue("Paris");
  } else {
    await expect(page.getByRole("radio").first()).toBeChecked();
  }
}

/** Navigates (via the question navigator) to the single-choice question, wherever it is. */
export async function showChoiceQuestion(page: Page): Promise<void> {
  const dots = page.getByRole("button", { name: /^Question \d+,/ });
  // count() does not auto-wait: without this the loop can run before the quiz has loaded (0 dots) and
  // wrongly conclude there is no single-choice question - which is what failed on the slower CI runner.
  await expect(dots.first()).toBeVisible();
  const total = await dots.count();
  for (let i = 0; i < total; i++) {
    await dots.nth(i).click();
    // Don't read the question type until the navigator has actually moved to the clicked question.
    await expect(dots.nth(i)).toHaveAttribute("aria-current", "step");
    if ((await currentQuestionKind(page)) === "choice") return;
  }
  throw new Error("No single-choice question found in the quiz");
}

/** Navigates to the last question (where the Submit button is). */
export async function showLastQuestion(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Question \d+,/ }).last().click();
}

export async function loginAsStudent(page: Page, world: World, returnUrl?: string): Promise<void> {
  await page.goto(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : "/login");
  await page.getByLabel("Email").fill(world.student.email);
  await page.getByLabel("Password", { exact: true }).fill(world.student.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // Don't return mid-login: callers navigate next, which would abort the in-flight sign-in request.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
