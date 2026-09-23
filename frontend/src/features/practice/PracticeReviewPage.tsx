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

  if (isLoading) return <Spinner label="Đang tải kết quả" />;
  if (isError || !data) {
    const message = isApiError(error) && error.status === 404 ? "Không tìm thấy bài luyện tập này." : "Không thể tải kết quả.";
    return <ErrorState message={message} onRetry={() => void refetch()} />;
  }

  const submitted = data.correctAnswers !== null;

  return (
    <div>
      <PageHeader
        title="Xem lại bài luyện tập"
        description={data.categoryName ?? undefined}
        action={
          <Link to="/student/history?tab=practice" className="qh-button qh-button--secondary">
            Quay lại lịch sử
          </Link>
        }
      />

      {!submitted && (
        <EmptyState
          title="Bài luyện tập này chưa được nộp"
          description="Hoàn thành và nộp bài để xem điểm cùng đáp án đúng."
          action={
            <Link to="/student/history?tab=practice" className="qh-button qh-button--primary">
              Đến lịch sử luyện tập
            </Link>
          }
        />
      )}

      {submitted && (
        <>
          <div className="qh-review-summary">
            <Card>
              <p className="qh-review-summary__value">{data.score !== null ? `${data.score} / 10` : "—"}</p>
              <p className="qh-review-summary__label">Điểm số</p>
            </Card>
            <Card>
              <p className="qh-review-summary__value">
                {data.correctAnswers} / {data.totalQuestions}
              </p>
              <p className="qh-review-summary__label">Câu trả lời đúng</p>
            </Card>
            <Card>
              <p className="qh-review-summary__value qh-review-summary__value--small">{formatDateTime(data.createdAt)}</p>
              <p className="qh-review-summary__label">Bắt đầu lúc</p>
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
        <span>Câu {number}</span>
        <Badge tone={detail.isCorrect ? "success" : "danger"}>{detail.isCorrect ? "Chính xác" : "Chưa chính xác"}</Badge>
      </div>
      <p className="qh-review-card__text">{detail.questionText}</p>

      {isFill ? (
        <dl className="qh-review-card__fill">
          <div>
            <dt>Câu trả lời của bạn</dt>
            <dd>{detail.selectedText && detail.selectedText.trim() !== "" ? detail.selectedText : "Chưa trả lời"}</dd>
          </div>
          {correctTexts.length > 0 && (
            <div>
              <dt>Đáp án đúng</dt>
              <dd>{correctTexts.join(" hoặc ")}</dd>
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
