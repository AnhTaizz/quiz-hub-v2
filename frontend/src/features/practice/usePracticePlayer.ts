import { useCallback, useEffect, useReducer, useRef } from "react";
import { practiceApi } from "@/api/practice.api";
import type { SaveStatus } from "@/components/feedback/SaveIndicator";
import type { PracticeQuestion, PracticeResult } from "@/types/api";
import {
  EMPTY_ANSWER,
  isAnswered,
  toAnswerRequest,
  valueFromQuestion,
  type AnswerValue,
} from "./practiceModel";
import {
  clearPracticeSession,
  loadPlayerState,
  savePlayerState,
  type PracticeSession,
} from "./practiceSession";

const FILL_IN_DEBOUNCE_MS = 500;
/** Backend ErrorCode PRACTICE_ALREADY_SUBMITTED: saving after submit is rejected with this code. */
const PRACTICE_ALREADY_SUBMITTED = 1033;

interface PlayerState {
  answers: Record<number, AnswerValue>;
  confirmed: Record<number, boolean>;
  flagged: Record<number, boolean>;
  saveStatus: Record<number, SaveStatus>;
  index: number;
  alreadySubmitted: boolean;
}

type Action =
  | { type: "answer"; questionId: number; value: AnswerValue }
  | { type: "confirm"; questionId: number }
  | { type: "flag"; questionId: number }
  | { type: "status"; questionId: number; status: SaveStatus }
  | { type: "index"; index: number }
  | { type: "alreadySubmitted" };

function reducer(state: PlayerState, action: Action): PlayerState {
  switch (action.type) {
    case "answer":
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.value },
        saveStatus: { ...state.saveStatus, [action.questionId]: "saving" },
      };
    case "confirm":
      return { ...state, confirmed: { ...state.confirmed, [action.questionId]: true } };
    case "flag":
      return { ...state, flagged: { ...state.flagged, [action.questionId]: !state.flagged[action.questionId] } };
    case "status":
      return { ...state, saveStatus: { ...state.saveStatus, [action.questionId]: action.status } };
    case "index":
      return { ...state, index: action.index };
    case "alreadySubmitted":
      return { ...state, alreadySubmitted: true };
  }
}

function initialState(session: PracticeSession): PlayerState {
  // Server progress first (a resumed practice), then whatever this tab persisted locally on top of it.
  const answers: Record<number, AnswerValue> = {};
  for (const question of session.questions) answers[question.id] = valueFromQuestion(question);

  const persisted = session.practiceId !== null ? loadPlayerState(session.practiceId) : null;
  if (persisted) Object.assign(answers, persisted.answers);

  const last = session.questions.length - 1;
  return {
    answers,
    confirmed: persisted?.confirmed ?? {},
    flagged: persisted?.flagged ?? {},
    saveStatus: {},
    index: Math.min(Math.max(persisted?.index ?? 0, 0), Math.max(last, 0)),
    alreadySubmitted: false,
  };
}

/**
 * State + autosave for one practice session. Practice has a different contract from the quiz player: there are no
 * per-answer revisions, saves are best-effort upserts, and the backend rejects saves after submit. Choice answers
 * save immediately, fill-in answers are debounced, and a failed save keeps the answer locally with a visible
 * retry (never console-only). Flashcard mode is study-only and saves nothing.
 */
export function usePracticePlayer(session: PracticeSession) {
  const [state, dispatch] = useReducer(reducer, session, initialState);
  const debounceTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const submittingRef = useRef(false);
  const savesEnabled = session.practiceId !== null && session.settings.displayMode !== "flashcard";

  // Survive a reload (the backend has no "resume current practice" call for a sequential range).
  useEffect(() => {
    if (session.practiceId === null) return;
    savePlayerState(session.practiceId, {
      answers: state.answers,
      confirmed: state.confirmed,
      flagged: state.flagged,
      index: state.index,
    });
  }, [session.practiceId, state.answers, state.confirmed, state.flagged, state.index]);

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  const persist = useCallback(
    async (question: PracticeQuestion, value: AnswerValue) => {
      if (!savesEnabled || session.practiceId === null) return;
      dispatch({ type: "status", questionId: question.id, status: "saving" });
      try {
        await practiceApi.saveAnswer(session.practiceId, toAnswerRequest(question, value));
        dispatch({ type: "status", questionId: question.id, status: "saved" });
      } catch (error) {
        if (typeof error === "object" && error !== null && (error as { code?: number }).code === PRACTICE_ALREADY_SUBMITTED) {
          dispatch({ type: "alreadySubmitted" });
        }
        dispatch({ type: "status", questionId: question.id, status: "error" });
      }
    },
    [savesEnabled, session.practiceId],
  );

  const setAnswer = useCallback(
    (question: PracticeQuestion, value: AnswerValue) => {
      dispatch({ type: "answer", questionId: question.id, value });
      // Instant feedback for single choice is locked as soon as it is answered (the legacy behavior).
      if (question.type === "SINGLE_CHOICE" && session.settings.showAnswer && isAnswered(value)) {
        dispatch({ type: "confirm", questionId: question.id });
      }
      if (question.type === "FILL_IN_BLANK") {
        clearTimeout(debounceTimers.current[question.id]);
        debounceTimers.current[question.id] = setTimeout(() => void persist(question, value), FILL_IN_DEBOUNCE_MS);
      } else {
        void persist(question, value);
      }
    },
    [persist, session.settings.showAnswer],
  );

  const retrySave = useCallback(
    (question: PracticeQuestion) => void persist(question, state.answers[question.id] ?? EMPTY_ANSWER),
    [persist, state.answers],
  );

  const confirmAnswer = useCallback((questionId: number) => dispatch({ type: "confirm", questionId }), []);
  const toggleFlag = useCallback((questionId: number) => dispatch({ type: "flag", questionId }), []);
  const goTo = useCallback((index: number) => dispatch({ type: "index", index }), []);

  const answeredCount = session.questions.filter((question) => isAnswered(state.answers[question.id])).length;

  /**
   * Submits every question (unanswered ones with empty values, as the legacy client does). Only one submit can be in
   * flight; the result is the backend's - the score is never computed here. Local recovery data is cleared only
   * after the backend confirmed the submit.
   */
  const submit = useCallback(async (): Promise<PracticeResult | null> => {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    try {
      // Flush pending fill-in saves' intent by sending the final values with the submit itself.
      for (const timer of Object.values(debounceTimers.current)) clearTimeout(timer);
      const result = await practiceApi.submit({
        categoryId: session.categoryId,
        practiceId: session.practiceId,
        answers: session.questions.map((question) =>
          toAnswerRequest(question, state.answers[question.id] ?? EMPTY_ANSWER),
        ),
      });
      clearPracticeSession(session.practiceId);
      return result;
    } finally {
      submittingRef.current = false;
    }
  }, [session, state.answers]);

  return { state, answeredCount, setAnswer, retrySave, confirmAnswer, toggleFlag, goTo, submit };
}
