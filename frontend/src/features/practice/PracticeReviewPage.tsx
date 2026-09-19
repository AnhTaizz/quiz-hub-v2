import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { practiceApi } from "@/api/practice.api";
import { isApiError } from "@/api/httpClient";
import type { PracticeDetail } from "@/types/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatDateTime } from "@/utils/format";
import "./PracticeReviewPage.css";

/**
 * Read-only review of one of the caller's own practices. Everything shown - score, per-question verdict, the
 * correct answers - comes from the backend detail response as-is: nothing is recomputed here, and fields the
 * backend leaves empty are simply not shown.
 */
export function PracticeReviewPage() {
  const { id } = useParams<{ id: string }>();
  const practiceId = Number(id);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["practice", "detail", practiceId],
    queryFn: ({ signal }) => practiceApi.detail(practiceId, signal),
    enabled: Number.isFinite(practiceId),
  });

  if (isLoading) return <Spinner label="Loading review" />;
  if (isError || !data) {
    const message = isApiError(error) && error.status === 404 ? "This practice could not be found." : "Could not load this review.";
    return <ErrorState message={message} onRetry={() => void refetch()} />;
  }

  const submitted = data.correctAnswers !== null;

  return (
    <div>
      <PageHeader
        title="Practice review"
        description={data.categoryName ?? undefined}
        action={
          <Link to="/student/history?tab=practice" className="qh-button qh-button--secondary">
            Back to history
          </Link>
        }
      />

      {!submitted && (
        <EmptyState
          title="This practice has not been submitted yet"
          description="Finish and submit it to see your score and the correct answers."
          action={
            <Link to="/student/history?tab=practice" className="qh-button qh-button--primary">
              Go to practice history
            </Link>
          }
        />
      )}

      {submitted && (
        <>
          <div className="qh-review-summary">
            <Card>
              <p className="qh-review-summary__value">{data.score !== null ? `${data.score} / 10` : "—"}</p>
              <p className="qh-review-summary__label">Score</p>
            </Card>
            <Card>
              <p className="qh-review-summary__value">
                {data.correctAnswers} / {data.totalQuestions}
              </p>
              <p className="qh-review-summary__label">Correct answers</p>
            </Card>
            <Card>
              <p className="qh-review-summary__value qh-review-summary__value--small">{formatDateTime(data.createdAt)}</p>
              <p className="qh-review-summary__label">Started</p>
            </Card>
          </div>

          <ol className="qh-review-list">
            {data.details.map((detail, index) => (
              <li key={detail.questionId}>
                <ReviewCard detail={detail} number={index + 1} />
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

function ReviewCard({ detail, number }: { detail: PracticeDetail; number: number }) {
  const selected = new Set(detail.selectedAnswerIds ?? []);
  const isFill = detail.questionType === "FILL_IN_BLANK";
  const correctTexts = detail.correctTexts ?? [];

  return (
    <Card className="qh-review-card">
      <div className="qh-review-card__header">
        <span>Question {number}</span>
        <Badge tone={detail.isCorrect ? "success" : "danger"}>{detail.isCorrect ? "Correct" : "Incorrect"}</Badge>
      </div>
      <p className="qh-review-card__text">{detail.questionText}</p>

      {isFill ? (
        <dl className="qh-review-card__fill">
          <div>
            <dt>Your answer</dt>
            <dd>{detail.selectedText && detail.selectedText.trim() !== "" ? detail.selectedText : "No answer"}</dd>
          </div>
          {correctTexts.length > 0 && (
            <div>
              <dt>Correct answer</dt>
              <dd>{correctTexts.join(" or ")}</dd>
            </div>
          )}
        </dl>
      ) : (
        <ul className="qh-review-card__answers">
          {detail.answers.map((answer) => {
            const wasSelected = selected.has(answer.id);
            return (
              <li
                key={answer.id}
                className={[
                  "qh-review-answer",
                  answer.isCorrect && "qh-review-answer--correct",
                  wasSelected && !answer.isCorrect && "qh-review-answer--wrong",
                  wasSelected && "qh-review-answer--selected",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {answer.text}
                {answer.isCorrect && <span className="visually-hidden"> (correct answer)</span>}
                {wasSelected && <span className="visually-hidden"> (your answer)</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
