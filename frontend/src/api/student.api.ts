import { httpClient } from "./httpClient";
import type {
  AssignedQuizSummary,
  Page,
  QuizHistoryItem,
  StudentDashboardResponse,
  UpdateProfileRequest,
  UserProfileResponse,
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

export const userApi = {
  getMyProfile: (signal?: AbortSignal) =>
    httpClient.get<UserProfileResponse>("/users/my-profile", { signal }),

  updateMyProfile: (payload: UpdateProfileRequest) =>
    httpClient.put<UserProfileResponse>("/users/my-profile", { body: payload }),

  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return httpClient.post<{ url: string }>("/users/upload-avatar", { formData });
  },
};
