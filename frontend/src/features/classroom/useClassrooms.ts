import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { classroomApi } from "@/api/classroom.api";

export function useClassroomList() {
  return useQuery({
    queryKey: ["student", "classrooms"],
    queryFn: ({ signal }) => classroomApi.list(signal),
  });
}

export function useClassroomDetail(id: number) {
  return useQuery({
    queryKey: ["student", "classrooms", id],
    queryFn: ({ signal }) => classroomApi.getDetail(id, signal),
    enabled: Number.isFinite(id),
  });
}

export function useJoinClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => classroomApi.join(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student", "classrooms"] });
    },
  });
}
