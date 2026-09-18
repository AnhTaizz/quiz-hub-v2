import { httpClient } from "./httpClient";
import type { StudentClassroomDetail, StudentClassroomSummary } from "@/types/api";

export const classroomApi = {
  list: (signal?: AbortSignal) =>
    httpClient.get<StudentClassroomSummary[]>("/student/classrooms", { signal }),

  getDetail: (id: number, signal?: AbortSignal) =>
    httpClient.get<StudentClassroomDetail>(`/student/classrooms/${id}`, { signal }),

  join: (code: string) =>
    httpClient.post<string>("/student/classrooms/join", { query: { code } }),
};
