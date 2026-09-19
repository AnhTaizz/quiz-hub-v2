import { httpClient } from "./httpClient";
import type {
  AssignedQuizSummary,
  Page,
  QuizHistoryItem,
  StudentDashboardResponse,
} from "@/types/api";

export const studentApi = {
  getDashboard: (signal?: AbortSignal) =>
    httpClient.get<StudentDashboardResponse>("/student/dashboard", { signal }),

  getAssignedQuizzes: (signal?: AbortSignal) =>
    httpClient.get<AssignedQuizSummary[]>("/student/quiz/assigned", { signal }),

  getHistoryPage: (page: number, size: number, signal?: AbortSignal) =>
    httpClient.get<Page<QuizHistoryItem>>("/student/quiz/history", {
      query: { page, size },
      signal,
    }),
};
