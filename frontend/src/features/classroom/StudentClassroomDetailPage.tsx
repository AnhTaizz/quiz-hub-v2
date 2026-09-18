import { useParams } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useClassroomDetail } from "./useClassrooms";
import "./Classroom.css";

export function StudentClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classroomId = Number(id);
  const { data, isLoading, isError, refetch } = useClassroomDetail(classroomId);

  if (isLoading) return <Spinner label="Loading classroom" />;
  if (isError) return <ErrorState message="Could not load this classroom." onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title={data.name} description={data.teacherName ? `Taught by ${data.teacherName}` : undefined} />

      {data.assignedQuizzes.length === 0 ? (
        <EmptyState title="No quizzes assigned in this classroom yet" />
      ) : (
        <div className="qh-classroom-grid">
          {data.assignedQuizzes.map((quiz) => (
            <AssignedQuizCard key={quiz.assigningId} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  );
}
