import type { PracticeQuestion } from "@/types/api";
import { DEFAULT_SETTINGS, seededShuffle, type AnswerValue, type PracticeSettings } from "./practiceModel";

// Hand-off between "start practice" and the player. The key names are the SAME ones the legacy Thymeleaf pages use
// (student-categories-*.js write them, then navigate to /student/practice/play), so the still-legacy category pages
// keep working against the React player. The backend has no "current practice" endpoint, so this is also the only
// place an in-progress session survives a reload (sessionStorage: per tab, cleared when the tab closes).

const KEY = {
  questions: "practice_questions",
  practiceId: "practice_id",
  categoryId: "practice_category_id",
  categoryName: "practice_category_name",
  offset: "practice_offset",
  settings: "practice_settings",
  settingsFor: (id: number) => `practice_settings_${id}`,
  shuffled: (id: number) => `practice_is_shuffled_${id}`,
  returnUrl: "studentReturnUrl",
} as const;

const playerKey = (practiceId: number) => `quizhub:practice:${practiceId}:state`;

export interface PracticeSession {
  questions: PracticeQuestion[];
  /** null for a stateless personal-quiz practice (nothing is saved server-side; that flow is still legacy). */
  practiceId: number | null;
  categoryId: number;
  categoryName: string;
  offset: number;
  settings: PracticeSettings;
}

function readJson<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function toNumber(value: string | null): number | null {
  if (value === null || value === "" || value === "null" || value === "undefined") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeQuestion(raw: unknown): PracticeQuestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const q = raw as Partial<PracticeQuestion>;
  if (typeof q.id !== "number" || typeof q.text !== "string" || typeof q.type !== "string") return null;
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    level: q.level ?? null,
    answers: Array.isArray(q.answers) ? q.answers : [],
    selectedAnswerIds: Array.isArray(q.selectedAnswerIds) ? q.selectedAnswerIds : null,
    selectedText: typeof q.selectedText === "string" ? q.selectedText : null,
    isCorrect: typeof q.isCorrect === "boolean" ? q.isCorrect : null,
  };
}

export function savePracticeSession(session: PracticeSession, storage: Storage = sessionStorage): void {
  try {
    storage.setItem(KEY.questions, JSON.stringify(session.questions));
    if (session.practiceId === null) storage.removeItem(KEY.practiceId);
    else storage.setItem(KEY.practiceId, String(session.practiceId));
    storage.setItem(KEY.categoryId, String(session.categoryId));
    storage.setItem(KEY.categoryName, session.categoryName);
    storage.setItem(KEY.offset, String(session.offset));
    const settings = JSON.stringify(session.settings);
    storage.setItem(KEY.settings, settings);
    if (session.practiceId !== null) storage.setItem(KEY.settingsFor(session.practiceId), settings);
  } catch {
    // Storage unavailable/full: the player will simply find no session and send the user back to setup.
  }
}

/** Returns null when there is no (valid) session to play. Applies the "shuffle questions" setting exactly once. */
export function loadPracticeSession(storage: Storage = sessionStorage): PracticeSession | null {
  const rawQuestions = readJson<unknown[]>(storage, KEY.questions);
  const categoryId = toNumber(storage.getItem(KEY.categoryId));
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0 || categoryId === null) return null;

  const questions = rawQuestions.map(normalizeQuestion).filter((q): q is PracticeQuestion => q !== null);
  if (questions.length === 0) return null;

  const practiceId = toNumber(storage.getItem(KEY.practiceId));
  const settings: PracticeSettings = {
    ...DEFAULT_SETTINGS,
    ...(readJson<Partial<PracticeSettings>>(storage, practiceId !== null ? KEY.settingsFor(practiceId) : KEY.settings) ??
      readJson<Partial<PracticeSettings>>(storage, KEY.settings) ??
      {}),
  };

  let ordered = questions;
  if (settings.shuffle && practiceId !== null && storage.getItem(KEY.shuffled(practiceId)) !== "true") {
    ordered = seededShuffle(questions, practiceId);
    try {
      storage.setItem(KEY.questions, JSON.stringify(ordered));
      storage.setItem(KEY.shuffled(practiceId), "true");
    } catch {
      // ignore: worst case the order is shuffled again with the same seed (deterministic).
    }
  }

  return {
    questions: ordered,
    practiceId,
    categoryId,
    categoryName: storage.getItem(KEY.categoryName) ?? "",
    offset: toNumber(storage.getItem(KEY.offset)) ?? 0,
    settings,
  };
}

/** The settings this tab used for a given practice (falls back to defaults after a browser restart). */
export function loadSettingsFor(practiceId: number, storage: Storage = sessionStorage): PracticeSettings | null {
  const stored = readJson<Partial<PracticeSettings>>(storage, KEY.settingsFor(practiceId));
  return stored ? { ...DEFAULT_SETTINGS, ...stored } : null;
}

export function clearPracticeSession(practiceId: number | null, storage: Storage = sessionStorage): void {
  try {
    for (const key of [KEY.questions, KEY.practiceId, KEY.categoryId, KEY.categoryName, KEY.offset, KEY.settings]) {
      storage.removeItem(key);
    }
    if (practiceId !== null) {
      storage.removeItem(KEY.settingsFor(practiceId));
      storage.removeItem(KEY.shuffled(practiceId));
      storage.removeItem(playerKey(practiceId));
    }
  } catch {
    // ignore
  }
}

// --- per-question player state (answers typed so far, locked feedback, flags, position) ---

export interface PersistedPlayerState {
  answers: Record<number, AnswerValue>;
  confirmed: Record<number, boolean>;
  flagged: Record<number, boolean>;
  index: number;
}

export function loadPlayerState(practiceId: number, storage: Storage = sessionStorage): PersistedPlayerState | null {
  const state = readJson<Partial<PersistedPlayerState>>(storage, playerKey(practiceId));
  if (!state || typeof state !== "object") return null;
  return {
    answers: state.answers ?? {},
    confirmed: state.confirmed ?? {},
    flagged: state.flagged ?? {},
    index: typeof state.index === "number" ? state.index : 0,
  };
}

export function savePlayerState(practiceId: number, state: PersistedPlayerState, storage: Storage = sessionStorage): void {
  try {
    storage.setItem(playerKey(practiceId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

// --- where "Exit" goes ---

/**
 * The legacy pages record the page the student came from in studentReturnUrl (often an absolute same-host URL).
 * Only a same-origin target is honored, converted to a relative path; anything else is discarded.
 */
export function normalizeReturnUrl(value: string | null, origin: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function readReturnUrl(storage: Storage = sessionStorage): string | null {
  return normalizeReturnUrl(storage.getItem(KEY.returnUrl), window.location.origin);
}
