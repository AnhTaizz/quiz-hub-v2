import { httpClient } from "./httpClient";
import type {
  PracticeAnswerRequest,
  PracticeHistoryItem,
  PracticeResult,
  PracticeStartRequest,
  PracticeStartResponse,
  PracticeSubmitRequest,
} from "@/types/api";

export const practiceApi = {
  start: (payload: PracticeStartRequest) =>
    httpClient.post<PracticeStartResponse>("/student/practice/start", { body: payload }),

  /** Number of PUBLIC questions in the category and all of its descendants. */
  count: (categoryId: number, signal?: AbortSignal) =>
    httpClient.get<number>("/student/practice/count", { query: { categoryId }, signal }),

  saveAnswer: (practiceId: number, payload: PracticeAnswerRequest, signal?: AbortSignal) =>
    httpClient.post<void>("/student/practice/save-answer", { query: { practiceId }, body: payload, signal }),

  submit: (payload: PracticeSubmitRequest) =>
    httpClient.post<PracticeResult>("/student/practice/submit", { body: payload }),

  /** All of the user's practices (completed and unfinished), newest first. The backend does not paginate this. */
  history: (signal?: AbortSignal) => httpClient.get<PracticeHistoryItem[]>("/student/practice/history", { signal }),

  /** Read-only detail of one of the caller's own practices (also used to resume an unfinished random practice). */
  detail: (id: number, signal?: AbortSignal) =>
    httpClient.get<PracticeResult>("/student/practice/history/detail", { query: { id }, signal }),
};
