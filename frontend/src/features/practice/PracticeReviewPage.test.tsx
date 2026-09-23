import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { practiceApi } from "@/api/practice.api";
import type { PracticeResult } from "@/types/api";
import { PracticeReviewPage } from "./PracticeReviewPage";

vi.mock("@/api/practice.api", () => ({ practiceApi: { detail: vi.fn() } }));
const api = vi.mocked(practiceApi);

function renderReview() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/student/practice/review/9"]}>
        <Routes>
          <Route path="/student/practice/review/:id" element={<PracticeReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function result(overrides: Partial<PracticeResult> = {}): PracticeResult {
  return {
    practiceId: 9,
    categoryName: "Algebra",
    totalQuestions: 2,
    correctAnswers: 1,
    score: 5,
    createdAt: "2026-09-19T08:30:00",
    details: [
      {
        questionId: 1,
        questionText: "<b>Pick B</b>",
        questionType: "SINGLE_CHOICE",
        questionLevel: null,
        selectedAnswerIds: [12],
        selectedText: null,
        correctAnswerIds: [12],
        correctTexts: null,
        isCorrect: true,
        answers: [
          { id: 11, text: "A", isCorrect: false },
          { id: 12, text: "B", isCorrect: true },
        ],
      },
      {
        questionId: 2,
        questionText: "Capital of France?",
        questionType: "FILL_IN_BLANK",
        questionLevel: null,
        selectedAnswerIds: null,
        selectedText: "Lyon",
        correctAnswerIds: null,
        correctTexts: ["Paris"],
        isCorrect: false,
        answers: [],
      },
    ],
    ...overrides,
  } as PracticeResult;
}

describe("PracticeReviewPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the backend score and verdicts read-only, with no form controls", async () => {
    api.detail.mockResolvedValue(result());
    const { container } = renderReview();

    expect(await screen.findByText("5 / 10")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("Chính xác")).toBeInTheDocument();
    expect(screen.getByText("Chưa chính xác")).toBeInTheDocument();
    expect(screen.getByText("Lyon")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(container.querySelectorAll("input, textarea, select")).toHaveLength(0);
  });

  it("renders question text as plain text, never as HTML", async () => {
    api.detail.mockResolvedValue(result());
    const { container } = renderReview();
    expect(await screen.findByText("<b>Pick B</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
  });

  it("does not show a score for a practice that was never submitted", async () => {
    api.detail.mockResolvedValue(result({ correctAnswers: null, score: null, details: [] }));
    renderReview();
    expect(await screen.findByText("Bài luyện tập này chưa được nộp")).toBeInTheDocument();
    expect(screen.queryByText("Điểm số")).not.toBeInTheDocument();
  });

  it("shows a not-found message for a practice that cannot be loaded", async () => {
    api.detail.mockRejectedValue({ status: 404, message: "missing" });
    renderReview();
    expect(await screen.findByText("Không tìm thấy bài luyện tập này.")).toBeInTheDocument();
  });
});
