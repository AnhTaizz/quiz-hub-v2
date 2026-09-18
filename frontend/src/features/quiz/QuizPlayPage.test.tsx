import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuizPlayByAssigningPage } from "./QuizPlayPage";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { quizApi } from "@/api/quiz.api";
import type { QuizTakingResponse } from "@/types/api";

vi.mock("@/api/quiz.api", () => ({
  quizApi: {
    start: vi.fn(),
    resume: vi.fn(),
    saveAnswer: vi.fn(),
    submit: vi.fn(),
    getResult: vi.fn(),
    logViolation: vi.fn(),
  },
}));

const mocked = vi.mocked(quizApi);

function quiz(overrides: Partial<QuizTakingResponse> = {}): QuizTakingResponse {
  return {
    attemptId: 99,
    quizTitle: "Sample quiz",
    durationInMins: 30,
    startedAt: new Date().toISOString(),
    startedAtMillis: Date.now(),
    questions: [
      {
        id: 1,
        text: "What is 2 + 2?",
        type: "SINGLE_CHOICE",
        level: "EASY",
        answers: [
          { id: 10, text: "3" },
          { id: 11, text: "4" },
        ],
      },
    ],
    selectedAnswers: {},
    selectedTexts: {},
    answerRevisions: {},
    ...overrides,
  };
}

function renderQuiz() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/student/quiz/play/5"]}>
          <Routes>
            <Route path="/student/quiz/play/:assigningId" element={<QuizPlayByAssigningPage />} />
            <Route path="/student/quiz/result/:attemptId" element={<p>Result page</p>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocked.saveAnswer.mockResolvedValue(undefined);
});

describe("QuizPlayPage", () => {
  it("renders HTML in question and answer text as inert text (F-01 regression)", async () => {
    const payload = "<img src=x onerror=alert(1)>";
    const scriptPayload = "<script>alert(1)</script>";
    mocked.start.mockResolvedValue(
      quiz({
        questions: [
          {
            id: 1,
            text: payload,
            type: "SINGLE_CHOICE",
            level: "EASY",
            answers: [{ id: 10, text: scriptPayload }],
          },
        ],
      }),
    );

    renderQuiz();

    expect(await screen.findByText(payload)).toBeInTheDocument();
    expect(screen.getByText(scriptPayload)).toBeInTheDocument();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("double-clicking Submit produces exactly one submit request", async () => {
    mocked.start.mockResolvedValue(quiz());
    mocked.submit.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ id: 99, score: 10 }), 100)),
    );
    const user = userEvent.setup();

    renderQuiz();
    await user.click(await screen.findByRole("button", { name: "Submit quiz" }));
    const confirm = await screen.findByRole("button", { name: "Submit" });
    await user.dblClick(confirm);

    expect(await screen.findByText("Result page")).toBeInTheDocument();
    expect(mocked.submit).toHaveBeenCalledTimes(1);
  });

  it("clears local recovery data only after a successful submit", async () => {
    mocked.start.mockResolvedValue(quiz());
    mocked.submit.mockRejectedValueOnce({ status: 500, message: "boom" });
    const user = userEvent.setup();

    renderQuiz();
    await user.click(await screen.findByLabelText("4"));
    await waitFor(() => expect(localStorage.getItem("quizhub:attempt:99")).not.toBeNull());

    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    await user.click(await screen.findByRole("button", { name: "Submit" }));

    // Failed submit: recovery data must still be there.
    await waitFor(() => expect(mocked.submit).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem("quizhub:attempt:99")).not.toBeNull();
  });

  it("debounces fill-in autosave instead of posting every keystroke", async () => {
    mocked.start.mockResolvedValue(
      quiz({
        questions: [{ id: 2, text: "Capital of France?", type: "FILL_IN_BLANK", level: "EASY", answers: [] }],
      }),
    );
    const user = userEvent.setup();

    renderQuiz();
    await user.type(await screen.findByLabelText("Your answer"), "Paris");

    await waitFor(() => expect(mocked.saveAnswer).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mocked.saveAnswer).toHaveBeenCalledWith(
      99,
      2,
      expect.objectContaining({ selectedText: "Paris", answerIds: null }),
    );
  });

  it("shows a visible save failure and keeps the answer locally", async () => {
    mocked.start.mockResolvedValue(quiz());
    mocked.saveAnswer.mockRejectedValue({ status: 0, message: "Network error" });
    const user = userEvent.setup();

    renderQuiz();
    await user.click(await screen.findByLabelText("4"));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem("quizhub:attempt:99") ?? "{}");
    expect(stored.answers["1"]).toMatchObject({ answerIds: [11], revision: 1 });
  });

  it("resends a locally-newer answer on resume (reconciliation replay)", async () => {
    localStorage.setItem(
      "quizhub:attempt:99",
      JSON.stringify({
        timestamp: Date.now(),
        answers: { "1": { answerIds: [11], selectedText: null, revision: 3 } },
      }),
    );
    mocked.start.mockResolvedValue(
      quiz({
        selectedAnswers: { "1": [10] },
        selectedTexts: {},
        answerRevisions: { "1": 1 },
      }),
    );

    renderQuiz();

    await waitFor(() => expect(mocked.saveAnswer).toHaveBeenCalledTimes(1));
    expect(mocked.saveAnswer).toHaveBeenCalledWith(
      99,
      1,
      expect.objectContaining({ answerIds: [11], revision: 3 }),
    );
    expect(await screen.findByLabelText("4")).toBeChecked();
  });
});
