import { PageHeader } from "@/components/layout/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useAssignedQuizzes } from "./useAssignedQuizzes";
import "./StudentDashboardPage.css";

export function StudentQuizListPage() {
  const { data, isLoading, isError, refetch } = useAssignedQuizzes();

  return (
    <div>
      <PageHeader title="Your quizzes" description="Quizzes assigned to you by your teachers." />

      {isLoading && <Spinner label="Loading quizzes" />}
      {isError && <ErrorState message="Could not load your quizzes." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          title="No quizzes assigned yet"
          description="Join a classroom to see quizzes assigned by your teacher."
        />
      )}

      {data && data.length > 0 && (
        <div className="qh-dashboard-quiz-grid">
          {data.map((quiz) => (
            <AssignedQuizCard key={quiz.assigningId} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  );
}
