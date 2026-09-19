import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PracticeQuestion, PracticeResult } from "@/types/api";
import { DEFAULT_SETTINGS } from "./practiceModel";
import type { PracticeSession } from "./practiceSession";
import { usePracticePlayer } from "./usePracticePlayer";

const api = vi.hoisted(() => ({ saveAnswer: vi.fn(), submit: vi.fn() }));
vi.mock("@/api/practice.api", () => ({ practiceApi: api }));

function question(id: number, type: PracticeQuestion["type"]): PracticeQuestion {
  return {
    id,
    text: `Question ${id}`,
    type,
    level: null,
    answers:
      type === "FILL_IN_BLANK"
        ? []
        : [
            { id: id * 10 + 1, text: "A", isCorrect: true },
            { id: id * 10 + 2, text: "B", isCorrect: false },
          ],
    selectedAnswerIds: null,
    selectedText: null,
    isCorrect: null,
  } as PracticeQuestion;
}

function session(overrides: Partial<PracticeSession> = {}): PracticeSession {
  return {
    questions: [question(1, "SINGLE_CHOICE"), question(2, "FILL_IN_BLANK")],
    practiceId: 77,
    categoryId: 5,
    categoryName: "Algebra",
    offset: 0,
    settings: { ...DEFAULT_SETTINGS },
    ...overrides,
  };
}

const RESULT: PracticeResult = {
  practiceId: 77,
  categoryName: "Algebra",
  totalQuestions: 2,
  correctAnswers: 1,
  score: 50,
  createdAt: null,
  details: [],
};

describe("usePracticePlayer", () => {
  beforeEach(() => {
    sessionStorage.clear();
    api.saveAnswer.mockReset().mockResolvedValue(undefined);
    api.submit.mockReset().mockResolvedValue(RESULT);
  });

  afterEach(() => vi.useRealTimers());

  it("saves a choice answer immediately", async () => {
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [11], text: "" }));
    expect(api.saveAnswer).toHaveBeenCalledTimes(1);
    expect(api.saveAnswer).toHaveBeenCalledWith(77, { questionId: 1, selectedAnswerId: 11 });
    expect(result.current.state.saveStatus[1]).toBe("saved");
    expect(result.current.answeredCount).toBe(1);
  });

  it("debounces fill-in answers into a single save with the last value", async () => {
    vi.useFakeTimers();
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    const fill = s.questions[1]!;
    act(() => result.current.setAnswer(fill, { ids: [], text: "x" }));
    act(() => result.current.setAnswer(fill, { ids: [], text: "xy" }));
    act(() => result.current.setAnswer(fill, { ids: [], text: "xyz" }));
    expect(api.saveAnswer).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(api.saveAnswer).toHaveBeenCalledTimes(1);
    expect(api.saveAnswer).toHaveBeenCalledWith(77, { questionId: 2, selectedText: "xyz" });
  });

  it("keeps the answer locally on a failed save, shows the error status and can retry", async () => {
    api.saveAnswer.mockRejectedValueOnce({ status: 500, message: "boom" });
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [12], text: "" }));
    expect(result.current.state.saveStatus[1]).toBe("error");
    expect(result.current.state.answers[1]).toEqual({ ids: [12], text: "" });

    await act(async () => result.current.retrySave(s.questions[0]!));
    expect(api.saveAnswer).toHaveBeenCalledTimes(2);
    expect(result.current.state.saveStatus[1]).toBe("saved");
  });

  it("flags an already-submitted practice when the backend rejects the save with code 1033", async () => {
    api.saveAnswer.mockRejectedValueOnce({ status: 400, code: 1033, message: "done" });
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [11], text: "" }));
    expect(result.current.state.alreadySubmitted).toBe(true);
    expect(result.current.state.saveStatus[1]).toBe("error");
  });

  it("allows only one submit in flight and returns the backend result untouched", async () => {
    let release!: (value: PracticeResult) => void;
    api.submit.mockReturnValue(new Promise<PracticeResult>((resolve) => (release = resolve)));
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));

    let first!: Promise<PracticeResult | null>;
    let second!: Promise<PracticeResult | null>;
    act(() => {
      first = result.current.submit();
      second = result.current.submit();
    });
    await expect(second).resolves.toBeNull();
    await act(async () => {
      release(RESULT);
      await first;
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
    await expect(first).resolves.toBe(RESULT);
  });

  it("submits every question, with empty values for the unanswered ones, and clears local recovery data", async () => {
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [11], text: "" }));
    expect(sessionStorage.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.submit();
    });
    const payload = api.submit.mock.calls[0]![0];
    expect(payload.practiceId).toBe(77);
    expect(payload.categoryId).toBe(5);
    expect(payload.answers).toHaveLength(2);
    expect(payload.answers[0]).toMatchObject({ questionId: 1, selectedAnswerId: 11 });
    expect(payload.answers[1]).toMatchObject({ questionId: 2 });
    expect(sessionStorage.getItem("practice_id")).toBeNull();
  });

  it("keeps local answers when the submit fails so it can be retried", async () => {
    api.submit.mockRejectedValueOnce({ status: 500, message: "boom" });
    const s = session();
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [11], text: "" }));

    await act(async () => {
      await expect(result.current.submit()).rejects.toMatchObject({ status: 500 });
    });
    expect(result.current.state.answers[1]).toEqual({ ids: [11], text: "" });

    await act(async () => {
      await expect(result.current.submit()).resolves.toBe(RESULT);
    });
    expect(api.submit).toHaveBeenCalledTimes(2);
  });

  it("does not save anything in flashcard (study-only) mode", async () => {
    const s = session({ settings: { ...DEFAULT_SETTINGS, displayMode: "flashcard" } });
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [11], text: "" }));
    expect(api.saveAnswer).not.toHaveBeenCalled();
  });

  it("locks single-choice instant feedback when show-answer is on", async () => {
    const s = session({ settings: { ...DEFAULT_SETTINGS, showAnswer: true } });
    const { result } = renderHook(() => usePracticePlayer(s));
    await act(async () => result.current.setAnswer(s.questions[0]!, { ids: [12], text: "" }));
    expect(result.current.state.confirmed[1]).toBe(true);
  });

  it("restores server progress for a resumed practice", () => {
    const resumed = question(1, "SINGLE_CHOICE");
    resumed.selectedAnswerIds = [11];
    const { result } = renderHook(() => usePracticePlayer(session({ questions: [resumed] })));
    expect(result.current.state.answers[1]).toEqual({ ids: [11], text: "" });
    expect(result.current.answeredCount).toBe(1);
  });
});
