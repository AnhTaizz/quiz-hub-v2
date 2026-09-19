import { beforeEach, describe, expect, it } from "vitest";
import type { PracticeQuestion } from "@/types/api";
import { DEFAULT_SETTINGS } from "./practiceModel";
import {
  clearPracticeSession,
  loadPlayerState,
  loadPracticeSession,
  normalizeReturnUrl,
  savePlayerState,
  savePracticeSession,
} from "./practiceSession";

function q(id: number): PracticeQuestion {
  return {
    id,
    text: `Question ${id}`,
    type: "SINGLE_CHOICE",
    level: "EASY",
    answers: [{ id: id * 10, text: "a", isCorrect: true }],
    selectedAnswerIds: null,
    selectedText: null,
    isCorrect: null,
  };
}

const session = {
  questions: [1, 2, 3, 4, 5, 6].map(q),
  practiceId: 42,
  categoryId: 7,
  categoryName: "Math > Algebra",
  offset: 10,
  settings: { ...DEFAULT_SETTINGS },
};

beforeEach(() => sessionStorage.clear());

describe("practice session storage", () => {
  it("round-trips a session", () => {
    savePracticeSession(session);
    expect(loadPracticeSession()).toEqual(session);
  });

  it("uses the legacy key names so the legacy category pages can hand off to the React player", () => {
    savePracticeSession(session);
    expect(sessionStorage.getItem("practice_id")).toBe("42");
    expect(sessionStorage.getItem("practice_category_id")).toBe("7");
    expect(sessionStorage.getItem("practice_category_name")).toBe("Math > Algebra");
    expect(JSON.parse(sessionStorage.getItem("practice_questions") ?? "[]")).toHaveLength(6);
    expect(JSON.parse(sessionStorage.getItem("practice_settings_42") ?? "{}")).toMatchObject({ showAnswer: true });
  });

  it("reads what the legacy page wrote (string ids, partial settings, no practice_id for personal quizzes)", () => {
    sessionStorage.setItem("practice_questions", JSON.stringify([q(1)]));
    sessionStorage.setItem("practice_category_id", "0");
    sessionStorage.setItem("practice_settings", JSON.stringify({ displayMode: "flashcard" }));
    const loaded = loadPracticeSession();
    expect(loaded?.practiceId).toBeNull();
    expect(loaded?.settings).toEqual({ ...DEFAULT_SETTINGS, displayMode: "flashcard" });
  });

  it("returns null when there is nothing (valid) to play", () => {
    expect(loadPracticeSession()).toBeNull();
    sessionStorage.setItem("practice_questions", "not json");
    sessionStorage.setItem("practice_category_id", "1");
    expect(loadPracticeSession()).toBeNull();
    sessionStorage.setItem("practice_questions", "[]");
    expect(loadPracticeSession()).toBeNull();
  });

  it("drops malformed questions instead of crashing", () => {
    sessionStorage.setItem("practice_questions", JSON.stringify([q(1), { nope: true }, null, 5]));
    sessionStorage.setItem("practice_category_id", "1");
    expect(loadPracticeSession()?.questions.map((x) => x.id)).toEqual([1]);
  });

  it("applies 'shuffle questions' exactly once and keeps the order stable across reloads", () => {
    savePracticeSession({ ...session, settings: { ...DEFAULT_SETTINGS, shuffle: true } });
    const first = loadPracticeSession()?.questions.map((x) => x.id);
    const second = loadPracticeSession()?.questions.map((x) => x.id);
    expect(first).toEqual(second);
    expect([...(first ?? [])].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sessionStorage.getItem("practice_is_shuffled_42")).toBe("true");
  });

  it("clear removes the session and the per-practice keys", () => {
    savePracticeSession(session);
    savePlayerState(42, { answers: {}, confirmed: {}, flagged: {}, index: 3 });
    clearPracticeSession(42);
    expect(loadPracticeSession()).toBeNull();
    expect(loadPlayerState(42)).toBeNull();
    expect(sessionStorage.getItem("practice_settings_42")).toBeNull();
  });
});

describe("player state", () => {
  it("round-trips answers, locked feedback, flags and position", () => {
    const state = {
      answers: { 1: { ids: [10], text: "" }, 2: { ids: [], text: "hello" } },
      confirmed: { 1: true },
      flagged: { 2: true },
      index: 4,
    };
    savePlayerState(9, state);
    expect(loadPlayerState(9)).toEqual(state);
  });

  it("tolerates a corrupted entry", () => {
    sessionStorage.setItem("quizhub:practice:9:state", "{broken");
    expect(loadPlayerState(9)).toBeNull();
  });
});

describe("normalizeReturnUrl", () => {
  const origin = "http://localhost:8080";
  it.each([
    ["http://localhost:8080/student/categories?type=mine", "/student/categories?type=mine"],
    ["/student/history", "/student/history"],
  ])("keeps a same-origin target: %s", (input, expected) => expect(normalizeReturnUrl(input, origin)).toBe(expected));

  it.each(["https://evil.example/x", "//evil.example", "javascript:alert(1)", "", null])(
    "discards %s",
    (input) => expect(normalizeReturnUrl(input, origin)).toBeNull(),
  );
});
