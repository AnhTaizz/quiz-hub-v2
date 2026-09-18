import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/api/student.api";

export function useDashboard() {
  return useQuery({
    queryKey: ["student", "dashboard"],
    queryFn: ({ signal }) => studentApi.getDashboard(signal),
  });
}

export function useAssignedQuizzes() {
  return useQuery({
    queryKey: ["student", "quizzes", "assigned"],
    queryFn: ({ signal }) => studentApi.getAssignedQuizzes(signal),
  });
}
