import { describe, expect, it } from "vitest";
import type { PracticeQuestion } from "@/types/api";
import {
  buildRangeChunks,
  evaluateAnswer,
  flattenCategories,
  resolveSetup,
  seededShuffle,
  toAnswerRequest,
  valueFromQuestion,
} from "./practiceModel";

function question(overrides: Partial<PracticeQuestion>): PracticeQuestion {
  return {
    id: 1,
    text: "Q",
    type: "SINGLE_CHOICE",
    level: "EASY",
    answers: [
      { id: 10, text: "right", isCorrect: true },
      { id: 11, text: "wrong", isCorrect: false },
    ],
    selectedAnswerIds: null,
    selectedText: null,
    isCorrect: null,
    ...overrides,
  };
}

describe("toAnswerRequest (the backend reads a different field per type)", () => {
  it("single choice -> selectedAnswerId", () => {
    expect(toAnswerRequest(question({}), { ids: [11], text: "" })).toEqual({ questionId: 1, selectedAnswerId: 11 });
  });
  it("single choice unanswered -> null id", () => {
    expect(toAnswerRequest(question({}), { ids: [], text: "" })).toEqual({ questionId: 1, selectedAnswerId: null });
  });
  it("multiple choice -> selectedAnswerIds", () => {
    expect(toAnswerRequest(question({ type: "MULTIPLE_CHOICE" }), { ids: [10, 11], text: "" })).toEqual({
      questionId: 1,
      selectedAnswerIds: [10, 11],
    });
  });
  it("fill-in -> selectedText (empty string when unanswered)", () => {
    expect(toAnswerRequest(question({ type: "FILL_IN_BLANK", answers: [] }), { ids: [], text: "" })).toEqual({
      questionId: 1,
      selectedText: "",
    });
  });
});

describe("evaluateAnswer (display-only feedback, mirrors server rules)", () => {
  it("is null while unanswered", () => {
    expect(evaluateAnswer(question({}), { ids: [], text: "" })).toBeNull();
  });
  it("single choice", () => {
    expect(evaluateAnswer(question({}), { ids: [10], text: "" })).toBe(true);
    expect(evaluateAnswer(question({}), { ids: [11], text: "" })).toBe(false);
  });
  it("multiple choice requires the exact set (no partial credit)", () => {
    const q = question({
      type: "MULTIPLE_CHOICE",
      answers: [
        { id: 1, text: "a", isCorrect: true },
        { id: 2, text: "b", isCorrect: true },
        { id: 3, text: "c", isCorrect: false },
      ],
    });
    expect(evaluateAnswer(q, { ids: [2, 1], text: "" })).toBe(true);
    expect(evaluateAnswer(q, { ids: [1], text: "" })).toBe(false);
    expect(evaluateAnswer(q, { ids: [1, 2, 3], text: "" })).toBe(false);
  });
  it("fill-in is trimmed and case-insensitive, like the server", () => {
    const q = question({ type: "FILL_IN_BLANK", answers: [{ id: 1, text: "Paris", isCorrect: true }] });
    expect(evaluateAnswer(q, { ids: [], text: "  paris " })).toBe(true);
    expect(evaluateAnswer(q, { ids: [], text: "London" })).toBe(false);
  });
});

describe("valueFromQuestion", () => {
  it("restores server progress and tolerates nulls", () => {
    expect(valueFromQuestion(question({ selectedAnswerIds: [10], selectedText: "x" }))).toEqual({ ids: [10], text: "x" });
    expect(valueFromQuestion(question({}))).toEqual({ ids: [], text: "" });
  });
});

describe("seededShuffle", () => {
  it("is deterministic for a seed, differs across seeds, and keeps every item", () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
    expect(seededShuffle(items, 42)).not.toEqual(seededShuffle(items, 43));
    expect([...seededShuffle(items, 7)].sort((a, b) => a - b)).toEqual(items);
  });
  it("does not mutate its input", () => {
    const items = [1, 2, 3, 4];
    seededShuffle(items, 1);
    expect(items).toEqual([1, 2, 3, 4]);
  });
});

describe("buildRangeChunks", () => {
  it("builds aligned chunks with a short final chunk", () => {
    expect(buildRangeChunks(25, 10)).toEqual([
      { offset: 0, limit: 10, from: 1, to: 10 },
      { offset: 10, limit: 10, from: 11, to: 20 },
      { offset: 20, limit: 10, from: 21, to: 25 },
    ]);
  });
  it("returns nothing for an empty category", () => expect(buildRangeChunks(0, 10)).toEqual([]));
  it("every offset is a multiple of the limit (the backend's offset/limit paging requirement)", () => {
    for (const chunk of buildRangeChunks(137, 20)) expect(chunk.offset % chunk.limit).toBe(0);
  });
});

describe("resolveSetup", () => {
  const base = { mode: "range" as const, total: 25, randomLimit: 10, chunkIndex: 1, chunkSize: 10 };

  it("resolves a range chunk", () => {
    expect(resolveSetup(base)).toEqual({ ok: true, value: { limit: 10, offset: 10, isRandom: false } });
  });
  it("requires a chunk to be chosen", () => {
    expect(resolveSetup({ ...base, chunkIndex: null })).toMatchObject({ ok: false });
  });
  it("resolves random mode", () => {
    expect(resolveSetup({ ...base, mode: "random", randomLimit: 5 })).toEqual({
      ok: true,
      value: { limit: 5, offset: 0, isRandom: true },
    });
  });
  it.each([0, -3, 1.5])("rejects an invalid random count (%s) - limit 0 would crash the backend", (randomLimit) => {
    expect(resolveSetup({ ...base, mode: "random", randomLimit })).toMatchObject({ ok: false });
  });
  it("rejects asking for more than available", () => {
    expect(resolveSetup({ ...base, mode: "random", randomLimit: 26 })).toMatchObject({ ok: false });
  });
  it("rejects an empty category", () => {
    expect(resolveSetup({ ...base, total: 0 })).toMatchObject({ ok: false });
  });
});

describe("flattenCategories", () => {
  it("flattens the tree using the full path as the label", () => {
    const tree = [
      { id: 1, name: "Math", fullPath: "Math", children: [{ id: 2, name: "Algebra", fullPath: "Math > Algebra", children: [] }] },
    ];
    expect(flattenCategories(tree)).toEqual([
      { id: 1, label: "Math" },
      { id: 2, label: "Math > Algebra" },
    ]);
  });
});
