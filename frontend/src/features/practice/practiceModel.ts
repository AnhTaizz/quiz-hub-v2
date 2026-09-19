import type { CategoryNode, PracticeAnswerRequest, PracticeQuestion } from "@/types/api";

/** What the student has entered for one question: chosen option ids (single/multiple) or free text (fill-in). */
export interface AnswerValue {
  ids: number[];
  text: string;
}

export const EMPTY_ANSWER: AnswerValue = { ids: [], text: "" };

export type DisplayMode = "sequential" | "all" | "flashcard";

/** Same shape the legacy player stores in sessionStorage ("practice_settings"), so both entry points interoperate. */
export interface PracticeSettings {
  showAnswer: boolean;
  shuffle: boolean;
  shuffleAnswers: boolean;
  displayMode: DisplayMode;
  isRandom: boolean;
}

export const DEFAULT_SETTINGS: PracticeSettings = {
  showAnswer: true,
  shuffle: false,
  shuffleAnswers: false,
  displayMode: "sequential",
  isRandom: false,
};

export function isAnswered(value: AnswerValue | undefined): boolean {
  return !!value && (value.ids.length > 0 || value.text.trim().length > 0);
}

/** Progress the server already has for this question (resumed practice). */
export function valueFromQuestion(question: PracticeQuestion): AnswerValue {
  return { ids: question.selectedAnswerIds ?? [], text: question.selectedText ?? "" };
}

/**
 * Body for save-answer/submit. The backend reads a different field per question type; unanswered questions are
 * sent with empty values (the legacy client does the same on submit, and the backend scores them as wrong).
 */
export function toAnswerRequest(question: PracticeQuestion, value: AnswerValue): PracticeAnswerRequest {
  switch (question.type) {
    case "SINGLE_CHOICE":
      return { questionId: question.id, selectedAnswerId: value.ids[0] ?? null };
    case "MULTIPLE_CHOICE":
      return { questionId: question.id, selectedAnswerIds: value.ids };
    case "FILL_IN_BLANK":
      return { questionId: question.id, selectedText: value.text };
  }
}

/**
 * DISPLAY-ONLY instant feedback for the optional "show answer" mode, derived from the answer key the backend
 * already sends at start. It mirrors the server's grading rules (exact set for multiple choice, trimmed
 * case-insensitive match for fill-in) but is never used for a score: the result always comes from submit.
 * Returns null while the question is unanswered.
 */
export function evaluateAnswer(question: PracticeQuestion, value: AnswerValue): boolean | null {
  if (!isAnswered(value)) return null;
  const correct = question.answers.filter((answer) => answer.isCorrect === true);

  switch (question.type) {
    case "SINGLE_CHOICE": {
      const chosen = question.answers.find((answer) => answer.id === value.ids[0]);
      return chosen?.isCorrect === true;
    }
    case "MULTIPLE_CHOICE": {
      const wanted = correct.map((answer) => answer.id).sort((a, b) => a - b);
      const given = [...value.ids].sort((a, b) => a - b);
      return wanted.length > 0 && wanted.length === given.length && wanted.every((id, i) => id === given[i]);
    }
    case "FILL_IN_BLANK": {
      const typed = value.text.trim().toLowerCase();
      return correct.some((answer) => answer.text.trim().toLowerCase() === typed);
    }
  }
}

export function correctTexts(question: PracticeQuestion): string[] {
  return question.answers.filter((answer) => answer.isCorrect === true).map((answer) => answer.text);
}

// --- deterministic shuffling (same generator as the legacy player, so a shuffled order stays stable) ---

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}

// --- setup helpers ---

export interface RangeChunk {
  offset: number;
  limit: number;
  from: number;
  to: number;
}

/**
 * Aligned chunks only. The backend pages sequential practice as PageRequest.of(offset / limit, limit), so an offset
 * that is not a multiple of the limit silently returns a different page than the one displayed; fixed-size chunks
 * (offset = k * size) are always safe.
 */
export function buildRangeChunks(total: number, chunkSize: number): RangeChunk[] {
  if (total <= 0 || chunkSize <= 0) return [];
  const chunks: RangeChunk[] = [];
  for (let offset = 0; offset < total; offset += chunkSize) {
    chunks.push({ offset, limit: chunkSize, from: offset + 1, to: Math.min(offset + chunkSize, total) });
  }
  return chunks;
}

export interface CategoryOption {
  id: number;
  label: string;
}

export function flattenCategories(nodes: CategoryNode[]): CategoryOption[] {
  const out: CategoryOption[] = [];
  const visit = (node: CategoryNode) => {
    out.push({ id: node.id, label: node.fullPath ?? node.name });
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return out;
}

export interface SetupInput {
  mode: "range" | "random";
  total: number;
  randomLimit: number;
  chunkIndex: number | null;
  chunkSize: number;
}

export interface SetupResolved {
  limit: number;
  offset: number;
  isRandom: boolean;
}

/** Returns the request parameters, or a user-facing reason why the selection cannot start. */
export function resolveSetup(input: SetupInput): { ok: true; value: SetupResolved } | { ok: false; error: string } {
  if (input.total <= 0) return { ok: false, error: "This category has no practice questions yet." };

  if (input.mode === "random") {
    if (!Number.isInteger(input.randomLimit) || input.randomLimit < 1) {
      return { ok: false, error: "Enter how many questions you want (at least 1)." };
    }
    if (input.randomLimit > input.total) {
      return { ok: false, error: `Only ${input.total} question${input.total === 1 ? "" : "s"} available.` };
    }
    return { ok: true, value: { limit: input.randomLimit, offset: 0, isRandom: true } };
  }

  const chunks = buildRangeChunks(input.total, input.chunkSize);
  const chunk = input.chunkIndex === null ? undefined : chunks[input.chunkIndex];
  if (!chunk) return { ok: false, error: "Choose a range of questions." };
  return { ok: true, value: { limit: chunk.limit, offset: chunk.offset, isRandom: false } };
}
