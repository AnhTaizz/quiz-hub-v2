import { httpClient } from "./httpClient";
import type {
  QuizResultResponse,
  QuizSubmitRequest,
  QuizSubmitResult,
  QuizTakingResponse,
  SaveAnswerRequest,
  ViolationRequest,
  ViolationResponse,
} from "@/types/api";

export const quizApi = {
  start: (assigningId: number, signal?: AbortSignal) =>
    httpClient.get<QuizTakingResponse>("/student/quiz/start", { query: { assigningId }, signal }),

  resume: (attemptId: number, signal?: AbortSignal) =>
    httpClient.get<QuizTakingResponse>("/student/quiz/resume", { query: { attemptId }, signal }),

  saveAnswer: (attemptId: number, questionId: number, payload: SaveAnswerRequest, signal?: AbortSignal) =>
    httpClient.post<void>("/student/quiz/save-answer", {
      query: { attemptId, questionId },
      body: payload,
      signal,
    }),

  submit: (payload: QuizSubmitRequest) =>
    httpClient.post<QuizSubmitResult>("/student/quiz/submit", { body: payload }),

  getResult: (attemptId: number, signal?: AbortSignal) =>
    httpClient.get<QuizResultResponse>("/student/quiz/result", { query: { attemptId }, signal }),

  logViolation: (payload: ViolationRequest) =>
    httpClient.post<ViolationResponse>("/student/quiz/log-violation", { body: payload }),
};
