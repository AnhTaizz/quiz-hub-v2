import { useCallback, useEffect, useReducer, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { quizApi } from "@/api/quiz.api";
import { isApiError } from "@/api/httpClient";
import type { QuestionTaking, QuizSubmitResult } from "@/types/api";
import { reconcileQuizState, type AnswerValue, type LocalQuestionState } from "./reconcileQuizState";
import { clearLocalAttempt, loadLocalAttempt, saveLocalAttempt } from "./localAttemptStorage";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type SubmitStatus = "idle" | "submitting" | "submitted" | "error";

export type QuizSource = { mode: "start"; assigningId: number } | { mode: "resume"; attemptId: number };

interface AttemptState {
  attemptId: number;
  quizTitle: string;
  durationInMins: number;
  startedAtMillis: number;
  questions: QuestionTaking[];
  answers: Record<number, AnswerValue>;
  revisions: Record<number, number>;
  saveStatus: Record<number, SaveStatus>;
  currentIndex: number;
  flags: Record<number, boolean>;
}

type Action =
  | { type: "init"; payload: AttemptState }
  | { type: "setAnswer"; questionId: number; value: AnswerValue }
  | { type: "setSaveStatus"; questionId: number; status: SaveStatus }
  | { type: "setIndex"; index: number }
  | { type: "toggleFlag"; questionId: number };

function reducer(state: AttemptState | null, action: Action): AttemptState | null {
  if (action.type === "init") return action.payload;
  if (!state) return state;

  switch (action.type) {
    case "setAnswer": {
      const nextRevision = (state.revisions[action.questionId] ?? 0) + 1;
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.value },
        revisions: { ...state.revisions, [action.questionId]: nextRevision },
        saveStatus: { ...state.saveStatus, [action.questionId]: "saving" },
      };
    }
    case "setSaveStatus":
      return { ...state, saveStatus: { ...state.saveStatus, [action.questionId]: action.status } };
    case "setIndex":
      return { ...state, currentIndex: action.index };
    case "toggleFlag":
      return { ...state, flags: { ...state.flags, [action.questionId]: !state.flags[action.questionId] } };
    default:
      return state;
  }
}

const FILL_IN_DEBOUNCE_MS = 500;

export function useQuizAttempt(source: QuizSource) {
  const query = useQuery({
    queryKey: source.mode === "start" ? ["quiz", "start", source.assigningId] : ["quiz", "resume", source.attemptId],
    queryFn: ({ signal }) =>
      source.mode === "start" ? quizApi.start(source.assigningId, signal) : quizApi.resume(source.attemptId, signal),
    // A background refetch here could silently overwrite in-progress local
    // answers with a stale server snapshot mid-quiz (Phase 16) - this data
    // is fetched exactly once per attempt; all further updates come from the
    // reducer + autosave responses, never from re-querying this endpoint.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const [state, dispatch] = useReducer(reducer, null);
  const initializedRef = useRef(false);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const submitStatusRef = useRef<SubmitStatus>("idle");

  // One-time reconciliation once the server responds - see reconcileQuizState.ts.
  useEffect(() => {
    if (!query.data || initializedRef.current) return;
    initializedRef.current = true;

    const data = query.data;
    const serverAnswers: Record<number, AnswerValue> = {};
    for (const question of data.questions) {
      serverAnswers[question.id] = {
        answerIds: data.selectedAnswers[question.id] ?? [],
        selectedText: data.selectedTexts[question.id] ?? null,
      };
    }

    const localAnswers: Record<number, LocalQuestionState> = loadLocalAttempt(data.attemptId);
    const reconciled = reconcileQuizState({
      serverAnswers,
      serverRevisions: data.answerRevisions,
      localAnswers,
    });

    dispatch({
      type: "init",
      payload: {
        attemptId: data.attemptId,
        quizTitle: data.quizTitle,
        durationInMins: data.durationInMins,
        startedAtMillis: data.startedAtMillis,
        questions: data.questions,
        answers: reconciled.answers,
        revisions: reconciled.revisions,
        saveStatus: Object.fromEntries(data.questions.map((q) => [q.id, "idle" as SaveStatus])),
        currentIndex: 0,
        flags: {},
      },
    });

    // Replay anything that was newer locally than on the server. Every id in
    // toReplay is guaranteed (by reconcileQuizState) to have an entry in both
    // maps; the fallbacks below only satisfy noUncheckedIndexedAccess.
    for (const questionId of reconciled.toReplay) {
      const value = reconciled.answers[questionId] ?? { answerIds: [], selectedText: null };
      const revision = reconciled.revisions[questionId] ?? 1;
      void persistAnswer(data.attemptId, questionId, value, revision);
    }
  }, [query.data]);

  // Every answer/revision change is written to localStorage immediately
  // (optimistic, synchronous) regardless of network outcome - this is what
  // lets a reload recover in-progress work even if the POST below is still
  // in flight or has failed.
  useEffect(() => {
    if (!state) return;
    const toStore: Record<number, LocalQuestionState> = {};
    for (const [questionId, value] of Object.entries(state.answers)) {
      toStore[Number(questionId)] = { ...value, revision: state.revisions[Number(questionId)] ?? 0 };
    }
    saveLocalAttempt(state.attemptId, toStore);
  }, [state]);

  async function persistAnswer(attemptId: number, questionId: number, value: AnswerValue, revision: number) {
    dispatch({ type: "setSaveStatus", questionId, status: "saving" });
    try {
      await quizApi.saveAnswer(attemptId, questionId, {
        answerIds: value.answerIds.length > 0 ? value.answerIds : null,
        selectedText: value.selectedText,
        revision,
      });
      dispatch({ type: "setSaveStatus", questionId, status: "saved" });
    } catch {
      // Fixes audit finding F-06: the legacy autosave only did
      // console.error() on failure, leaving the student unaware their
      // answer wasn't saved. The value stays in local state/localStorage
      // regardless (see the effect above), and the UI surfaces "error" so
      // the caller can show a persistent warning + retry.
      dispatch({ type: "setSaveStatus", questionId, status: "error" });
    }
  }

  const setChoiceAnswer = useCallback(
    (questionId: number, answerIds: number[]) => {
      if (!state) return;
      const value: AnswerValue = { answerIds, selectedText: null };
      dispatch({ type: "setAnswer", questionId, value });
      const revision = (state.revisions[questionId] ?? 0) + 1;
      // Multiple-choice/single-choice: immediate autosave (Phase "multiple choice").
      void persistAnswer(state.attemptId, questionId, value, revision);
    },
    [state],
  );

  const setFillAnswer = useCallback(
    (questionId: number, text: string) => {
      if (!state) return;
      const value: AnswerValue = { answerIds: [], selectedText: text };
      dispatch({ type: "setAnswer", questionId, value });
      const revision = (state.revisions[questionId] ?? 0) + 1;

      clearTimeout(debounceTimers.current[questionId]);
      debounceTimers.current[questionId] = setTimeout(() => {
        void persistAnswer(state.attemptId, questionId, value, revision);
      }, FILL_IN_DEBOUNCE_MS);
    },
    [state],
  );

  const retrySave = useCallback(
    (questionId: number) => {
      if (!state) return;
      const value = state.answers[questionId] ?? { answerIds: [], selectedText: null };
      const revision = state.revisions[questionId] ?? 0;
      void persistAnswer(state.attemptId, questionId, value, revision);
    },
    [state],
  );

  const goToQuestion = useCallback((index: number) => dispatch({ type: "setIndex", index }), []);
  const toggleFlag = useCallback((questionId: number) => dispatch({ type: "toggleFlag", questionId }), []);

  const submit = useCallback(async (): Promise<QuizSubmitResult | null> => {
    if (!state || submitStatusRef.current === "submitting") return null;
    submitStatusRef.current = "submitting";
    try {
      const result = await quizApi.submit({
        attemptId: state.attemptId,
        questions: state.questions.map((q) => ({
          questionId: q.id,
          answerIds: state.answers[q.id]?.answerIds ?? [],
          selectedText: state.answers[q.id]?.selectedText ?? "",
          revision: state.revisions[q.id] ?? 0,
        })),
      });
      // Recovery data is cleared ONLY after a confirmed successful submit -
      // never before, so an interrupted/failed submit still leaves it in
      // place for a retry.
      clearLocalAttempt(state.attemptId);
      submitStatusRef.current = "submitted";
      return result;
    } catch (error) {
      submitStatusRef.current = "error";
      throw error;
    }
  }, [state]);

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  return {
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    errorMessage: isApiError(query.error) ? query.error.message : null,
    refetch: query.refetch,
    state,
    setChoiceAnswer,
    setFillAnswer,
    retrySave,
    goToQuestion,
    toggleFlag,
    submit,
  };
}
