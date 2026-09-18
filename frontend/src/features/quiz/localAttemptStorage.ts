import type { LocalQuestionState } from "./reconcileQuizState";

interface StoredAttempt {
  answers: Record<number, LocalQuestionState>;
  timestamp: number;
}

function storageKey(attemptId: number): string {
  return `quizhub:attempt:${attemptId}`;
}

export function loadLocalAttempt(attemptId: number): Record<number, LocalQuestionState> {
  try {
    const raw = localStorage.getItem(storageKey(attemptId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredAttempt;
    return parsed.answers ?? {};
  } catch {
    // Corrupted localStorage must not crash the quiz - fall back to
    // server-only state rather than losing the whole attempt (audit finding:
    // the legacy client redirected away with no specific message here).
    return {};
  }
}

export function saveLocalAttempt(attemptId: number, answers: Record<number, LocalQuestionState>): void {
  try {
    const payload: StoredAttempt = { answers, timestamp: Date.now() };
    localStorage.setItem(storageKey(attemptId), JSON.stringify(payload));
  } catch {
    // Storage full/unavailable (e.g. private browsing) - autosave to the
    // server still proceeds independently; only crash recovery is degraded.
  }
}

/** Called ONLY after a successful submit - never before, so a failed or
 * interrupted submit still leaves recovery data in place. */
export function clearLocalAttempt(attemptId: number): void {
  try {
    localStorage.removeItem(storageKey(attemptId));
  } catch {
    // ignore
  }
}
