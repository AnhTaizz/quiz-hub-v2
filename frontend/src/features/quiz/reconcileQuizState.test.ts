import { describe, expect, it } from "vitest";
import { reconcileQuizState, type ReconcileInput } from "./reconcileQuizState";

function input(overrides: Partial<ReconcileInput>): ReconcileInput {
  return {
    serverAnswers: {},
    serverRevisions: {},
    localAnswers: {},
    ...overrides,
  };
}

describe("reconcileQuizState", () => {
  it("server newer: keeps server value, does not replay", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [10], selectedText: null } },
        serverRevisions: { 1: 5 },
        localAnswers: { 1: { answerIds: [11], selectedText: null, revision: 3 } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [10], selectedText: null });
    expect(result.revisions[1]).toBe(5);
    expect(result.toReplay).toEqual([]);
  });

  it("local newer: keeps local value and queues it for replay", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [10], selectedText: null } },
        serverRevisions: { 1: 2 },
        localAnswers: { 1: { answerIds: [11], selectedText: null, revision: 4 } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [11], selectedText: null });
    expect(result.revisions[1]).toBe(4);
    expect(result.toReplay).toEqual([1]);
  });

  it("equal revision: uses server value, does not replay (already in sync)", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [10], selectedText: null } },
        serverRevisions: { 1: 3 },
        localAnswers: { 1: { answerIds: [10], selectedText: null, revision: 3 } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [10], selectedText: null });
    expect(result.toReplay).toEqual([]);
  });

  it("legacy local state (missing/invalid revision) loses to a real server revision", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [10], selectedText: null } },
        serverRevisions: { 1: 1 },
        localAnswers: { 1: { answerIds: [99], selectedText: null, revision: Number.NaN } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [10], selectedText: null });
    expect(result.toReplay).toEqual([]);
  });

  it("legacy local state still wins when the server has never seen the question", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: {},
        serverRevisions: {},
        localAnswers: { 1: { answerIds: [99], selectedText: null, revision: Number.NaN } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [99], selectedText: null });
    expect(result.revisions[1]).toBe(1);
    expect(result.toReplay).toEqual([1]);
  });

  it("local-only question (never synced) is kept and queued for replay", () => {
    const result = reconcileQuizState(
      input({
        localAnswers: { 7: { answerIds: [1], selectedText: null, revision: 1 } },
      }),
    );
    expect(result.answers[7]).toEqual({ answerIds: [1], selectedText: null });
    expect(result.toReplay).toEqual([7]);
  });

  it("server-only question (never answered locally) is kept as-is", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 3: { answerIds: [], selectedText: null } },
        serverRevisions: { 3: 0 },
      }),
    );
    expect(result.answers[3]).toEqual({ answerIds: [], selectedText: null });
    expect(result.toReplay).toEqual([]);
  });

  it("handles an empty answer (question seen but never actually answered)", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [], selectedText: null } },
        serverRevisions: { 1: 0 },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [], selectedText: null });
  });

  it("handles a fill-in-blank answer (selectedText, no answerIds)", () => {
    const result = reconcileQuizState(
      input({
        localAnswers: { 1: { answerIds: [], selectedText: "photosynthesis", revision: 2 } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [], selectedText: "photosynthesis" });
    expect(result.toReplay).toEqual([1]);
  });

  it("handles a multiple-choice answer (multiple answerIds)", () => {
    const result = reconcileQuizState(
      input({
        serverAnswers: { 1: { answerIds: [1, 2], selectedText: null } },
        serverRevisions: { 1: 1 },
        localAnswers: { 1: { answerIds: [1, 2, 3], selectedText: null, revision: 2 } },
      }),
    );
    expect(result.answers[1]).toEqual({ answerIds: [1, 2, 3], selectedText: null });
    expect(result.toReplay).toEqual([1]);
  });

  it("reconciles multiple questions independently in one call", () => {
    const result = reconcileQuizState({
      serverAnswers: {
        1: { answerIds: [1], selectedText: null },
        2: { answerIds: [], selectedText: "answer" },
      },
      serverRevisions: { 1: 2, 2: 1 },
      localAnswers: {
        1: { answerIds: [2], selectedText: null, revision: 5 }, // local newer
        2: { answerIds: [], selectedText: "answer", revision: 1 }, // equal
        3: { answerIds: [4], selectedText: null, revision: 1 }, // local only
      },
    });
    expect(result.toReplay.sort()).toEqual([1, 3]);
    expect(result.answers[1]).toEqual({ answerIds: [2], selectedText: null });
    expect(result.answers[2]).toEqual({ answerIds: [], selectedText: "answer" });
    expect(result.answers[3]).toEqual({ answerIds: [4], selectedText: null });
  });
});
