import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import type { PracticeQuestion, PracticeResult } from "@/types/api";
import { DEFAULT_SETTINGS } from "./practiceModel";
import { savePracticeSession } from "./practiceSession";
import { PracticePlayPage } from "./PracticePlayPage";

const api = vi.hoisted(() => ({ saveAnswer: vi.fn(), submit: vi.fn() }));
vi.mock("@/api/practice.api", () => ({ practiceApi: api }));

const questions = [
  {
    id: 1,
    text: "Pick the first letter",
    type: "SINGLE_CHOICE",
    level: null,
    answers: [
      { id: 11, text: "A", isCorrect: true },
      { id: 12, text: "B", isCorrect: false },
    ],
    selectedAnswerIds: null,
    selectedText: null,
    isCorrect: null,
  },
] as PracticeQuestion[];

const RESULT: PracticeResult = {
  practiceId: 77,
  categoryName: "Algebra",
  totalQuestions: 1,
  correctAnswers: 1,
  score: 10,
  createdAt: null,
  details: [],
};

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderPlay() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/student/practice/play"]}>
        <Routes>
          <Route path="/student/practice/play" element={<PracticePlayPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

function seed(practiceId: number | null = 77) {
  savePracticeSession({
    questions,
    practiceId,
    categoryId: 5,
    categoryName: "Algebra",
    offset: 0,
    settings: { ...DEFAULT_SETTINGS, showAnswer: false },
  });
}

describe("PracticePlayPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    api.saveAnswer.mockReset().mockResolvedValue(undefined);
    api.submit.mockReset().mockResolvedValue(RESULT);
  });

  it("offers to set up a practice when nothing is in progress", () => {
    renderPlay();
    expect(screen.getByText("No practice in progress")).toBeInTheDocument();
  });

  it("shows a visible save error with a retry that keeps the chosen answer", async () => {
    seed();
    api.saveAnswer.mockRejectedValueOnce({ status: 500, message: "boom" });
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole("radio", { name: "B" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "B" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(api.saveAnswer).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("asks for confirmation, submits once, and navigates to the review with the backend result", async () => {
    seed();
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole("radio", { name: "A" }));
    await user.click(screen.getByRole("button", { name: "Submit practice" }));
    expect(api.submit).not.toHaveBeenCalled();
    expect(screen.getByText(/1 of 1 questions/)).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Submit" });
    await user.dblClick(confirm);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/student/practice/review/77"));
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.mock.calls[0]![0]).toMatchObject({ practiceId: 77, categoryId: 5 });
  });

  it("stays on the page with a toast when submit fails, keeping the answer", async () => {
    seed();
    api.submit.mockRejectedValueOnce({ status: 500, message: "Server exploded" });
    const user = userEvent.setup();
    renderPlay();

    await user.click(await screen.findByRole("radio", { name: "A" }));
    await user.click(screen.getByRole("button", { name: "Submit practice" }));
    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/Server exploded|Could not submit/)).toBeInTheDocument();
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "A" })).toBeChecked();
  });
});
