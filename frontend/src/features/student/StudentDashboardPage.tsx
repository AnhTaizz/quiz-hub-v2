import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useDashboard } from "./useAssignedQuizzes";
import "./StudentDashboardPage.css";

export function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboard();

  return (
    <div>
      <PageHeader title={`${data?.greeting ?? "Hello"}, ${user?.fullName ?? ""}`} />

      {isLoading && <Spinner label="Loading dashboard" />}
      {isError && <ErrorState message="Could not load your dashboard." onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="qh-dashboard-summary">
            <Card>
              <p className="qh-dashboard-summary__value">{data.totalCompleted}</p>
              <p className="qh-dashboard-summary__label">Quizzes completed</p>
            </Card>
            <Card>
              <p className="qh-dashboard-summary__value">{data.quizAvg?.toFixed(1) ?? "-"}</p>
              <p className="qh-dashboard-summary__label">Average score</p>
            </Card>
            <Card>
              <p className="qh-dashboard-summary__value">{data.pendingCount}</p>
              <p className="qh-dashboard-summary__label">Pending quizzes</p>
            </Card>
          </div>

          <h2 className="qh-dashboard-section-title">Assigned to you</h2>
          {data.assignedQuizzes.length === 0 ? (
            <EmptyState
              title="No quizzes assigned yet"
              description="Join a classroom to see quizzes assigned by your teacher."
            />
          ) : (
            <div className="qh-dashboard-quiz-grid">
              {data.assignedQuizzes.map((quiz) => (
                <AssignedQuizCard key={quiz.assigningId} quiz={quiz} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
