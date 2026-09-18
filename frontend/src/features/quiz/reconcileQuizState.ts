export interface AnswerValue {
  answerIds: number[];
  selectedText: string | null;
}

export interface LocalQuestionState extends AnswerValue {
  revision: number;
}

export interface ReconcileInput {
  serverAnswers: Record<number, AnswerValue>;
  serverRevisions: Record<number, number>;
  localAnswers: Record<number, LocalQuestionState>;
}

export interface ReconcileResult {
  answers: Record<number, AnswerValue>;
  revisions: Record<number, number>;
  /** questionIds whose local value is newer than the server's and must be re-POSTed. */
  toReplay: number[];
}

/**
 * Pure merge of server-authoritative quiz-attempt state with locally cached
 * (localStorage) state, keyed by the per-question revision the backend
 * already tracks for optimistic-concurrency autosave (see
 * StudentQuizRestController#saveAnswer / SaveAnswerRequestDTO.revision).
 *
 * Per question, the higher revision wins:
 *  - server revision > local revision (or no local entry): server value is
 *    authoritative, local is discarded as stale (e.g. answered on another
 *    device/tab since).
 *  - local revision > server revision (including a question the server has
 *    never seen at all, i.e. answered while offline before the first save
 *    ever succeeded): local value is kept and queued in `toReplay` so the
 *    caller re-sends it to the server.
 *  - equal revision: values are already in sync; server value is used and
 *    nothing is replayed.
 *
 * A local entry with a missing/invalid revision (e.g. written by an older
 * client version - "legacy local state") is treated as revision 0, so any
 * real server revision (>= 1) wins over it, while it still wins over a
 * question the server has no record of at all.
 */
export function reconcileQuizState({
  serverAnswers,
  serverRevisions,
  localAnswers,
}: ReconcileInput): ReconcileResult {
  const questionIds = new Set<number>([
    ...Object.keys(serverRevisions).map(Number),
    ...Object.keys(localAnswers).map(Number),
  ]);

  const answers: Record<number, AnswerValue> = {};
  const revisions: Record<number, number> = {};
  const toReplay: number[] = [];

  for (const questionId of questionIds) {
    const server = serverAnswers[questionId];
    const serverRevision = serverRevisions[questionId] ?? 0;
    const local = localAnswers[questionId];

    if (!local) {
      answers[questionId] = server ?? { answerIds: [], selectedText: null };
      revisions[questionId] = serverRevision;
      continue;
    }

    const localRevision = Number.isFinite(local.revision) ? local.revision : 0;
    const localValue: AnswerValue = { answerIds: local.answerIds, selectedText: local.selectedText };

    if (!server) {
      // Server has never seen this question's answer at all.
      answers[questionId] = localValue;
      revisions[questionId] = Math.max(localRevision, 1);
      toReplay.push(questionId);
      continue;
    }

    if (localRevision > serverRevision) {
      answers[questionId] = localValue;
      revisions[questionId] = localRevision;
      toReplay.push(questionId);
    } else {
      answers[questionId] = server;
      revisions[questionId] = serverRevision;
    }
  }

  return { answers, revisions, toReplay };
}
