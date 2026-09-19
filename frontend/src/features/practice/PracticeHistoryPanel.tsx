import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { practiceApi } from "@/api/practice.api";
import { isApiError } from "@/api/httpClient";
import type { PracticeHistoryItem } from "@/types/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { formatDateTime } from "@/utils/format";
import { buildResumeSession } from "./resumePractice";
import { savePracticeSession } from "./practiceSession";
import "./PracticeHistoryPanel.css";

/**
 * The backend returns ALL of the user's practices in one unpaginated list (newest first); there is no page/size
 * contract to honor, so none is faked here. If that list grows large, pagination has to be added to the API first.
 */
export function PracticeHistoryPanel() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["practice", "history"],
    queryFn: ({ signal }) => practiceApi.history(signal),
  });

  if (isLoading) return <Spinner label="Loading practice history" />;
  if (isError) return <ErrorState message="Could not load your practice history." onRetry={() => void refetch()} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No practice sessions yet"
        description="Start a practice to see it here."
        action={
          <Link to="/student/practice" className="qh-button qh-button--primary">
            Start practicing
          </Link>
        }
      />
    );
  }

  return (
    <ul className="qh-practice-history">
      {data.map((item) => (
        <li key={item.id}>
          <PracticeHistoryCard item={item} />
        </li>
      ))}
    </ul>
  );
}

function PracticeHistoryCard({ item }: { item: PracticeHistoryItem }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const resume = useMutation({
    mutationFn: () => buildResumeSession(item),
    onSuccess: (session) => {
      savePracticeSession(session);
      navigate("/student/practice/play");
    },
    onError: (error) => showToast(isApiError(error) ? error.message : "Could not resume this practice.", "error"),
  });

  const total = item.totalQuestions ?? 0;
  const percent = item.isCompleted && total > 0 ? Math.round(((item.correctAnswers ?? 0) / total) * 100) : null;

  return (
    <Card className="qh-practice-history__item">
      <div className="qh-practice-history__main">
        <p className="qh-practice-history__title">{item.categoryName ?? "Practice"}</p>
        <p className="qh-practice-history__meta">
          {formatDateTime(item.createdAt)} · {item.isRandom ? "Random" : "In order"}
          {!item.isCompleted && total > 0 && ` · ${item.answeredQuestions ?? 0} of ${total} answered`}
        </p>
      </div>
      <div className="qh-practice-history__status">
        {item.isCompleted ? (
          <>
            <Badge tone="success">{percent !== null ? `${percent}%` : "Completed"}</Badge>
            <Link to={`/student/practice/review/${item.id}`} className="qh-button qh-button--secondary">
              Review
            </Link>
          </>
        ) : (
          <>
            <Badge tone="warning">In progress</Badge>
            <Button type="button" variant="secondary" isLoading={resume.isPending} onClick={() => resume.mutate()}>
              Resume
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
