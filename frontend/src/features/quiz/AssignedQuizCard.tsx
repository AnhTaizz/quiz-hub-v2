import { Link } from "react-router";
import type { AssignedQuizSummary } from "@/types/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getQuizAvailability } from "./quizAvailability";
import { formatDateTime } from "@/utils/format";
import "./AssignedQuizCard.css";

export function AssignedQuizCard({ quiz, variant = "card" }: { quiz: AssignedQuizSummary; variant?: "card" | "task" }) {
  const availability = getQuizAvailability(quiz);
  const attemptsExhausted = quiz.attemptsLeft === 0;
  const maxAttempts = quiz.maxAttempt && quiz.maxAttempt > 0 ? quiz.maxAttempt : null;
  const attemptPercent = maxAttempts ? Math.min(100, (quiz.attemptsMade / maxAttempts) * 100) : 0;

  if (variant === "task") {
    return (
      <article className="qh-task-card">
        <div className="qh-task-card__layout">
          <div className="qh-task-card__summary">
            <div className="qh-task-card__icon" aria-hidden="true">
              <i className="bi bi-file-earmark-text" />
            </div>
            <div className="qh-task-card__body">
              <h3>{quiz.quizTitle ?? "Đề thi chưa đặt tên"}</h3>
              <div className="qh-task-card__chips">
                {quiz.durationInMins != null && (
                  <span className="qh-task-card__chip">
                    <i className="bi bi-clock" aria-hidden="true" /> {quiz.durationInMins} phút
                  </span>
                )}
                <span className={`qh-task-card__chip ${quiz.attemptsMade > 0 ? "qh-task-card__chip--attempted" : ""}`}>
                  <i className="bi bi-person-walking" aria-hidden="true" /> Lượt: {quiz.attemptsMade} / {maxAttempts ?? "∞"}
                </span>
                <span className="qh-task-card__chip qh-task-card__chip--due">
                  <i className="bi bi-calendar-event" aria-hidden="true" /> Hạn: {quiz.dueDate ? formatDateTime(quiz.dueDate) : "Không thời hạn"}
                </span>
              </div>
            </div>
          </div>
          <div className="qh-task-card__actions">
            <a
              href={`/student/quiz/history/${quiz.assigningId}`}
              className="qh-task-card__action qh-task-card__history"
            >
              <i className="bi bi-clock-history" aria-hidden="true" />
              <span>Lịch sử</span>
            </a>
            {availability === "available" && !attemptsExhausted ? (
              <Link
                to={`/student/quiz/play/${quiz.assigningId}`}
                className="qh-task-card__action qh-task-card__start"
              >
                <i className="bi bi-pencil-square" aria-hidden="true" />
                <span>{quiz.hasUnfinished ? "Tiếp tục" : "Làm bài"}</span>
              </Link>
            ) : (
              <span className="qh-task-card__action qh-task-card__disabled">
                {availability === "not_started" ? "Sắp tới" : availability === "expired" ? "Hết hạn" : "Hết lượt"}
              </span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <Card className="qh-quiz-card">
      <div className="qh-quiz-card__header">
        {availability === "not_started" && <Badge tone="warning">Sắp tới</Badge>}
        {availability === "expired" && <Badge tone="danger">Hết hạn</Badge>}
        {availability === "available" && <Badge tone="success">Đang mở</Badge>}
        <i className="bi bi-three-dots" aria-hidden="true" />
      </div>

      <h3 className="qh-quiz-card__title">{quiz.quizTitle ?? "Đề thi chưa đặt tên"}</h3>

      <dl className="qh-quiz-card__facts">
        {quiz.durationInMins != null && (
          <div>
            <i className="bi bi-stopwatch" />
            <span><dt>Thời gian</dt><dd>{quiz.durationInMins} phút</dd></span>
          </div>
        )}
        <div>
          <i className="bi bi-arrow-repeat" />
          <span><dt>Lượt làm</dt><dd>{quiz.attemptsMade} / {maxAttempts ?? "∞"}</dd></span>
        </div>
      </dl>

      <div className="qh-quiz-card__progress">
        <span><b>Tiến độ lượt làm</b><b>{maxAttempts ? `${quiz.attemptsMade} / ${maxAttempts}` : "Không giới hạn"}</b></span>
        <div><i style={{ width: `${attemptPercent}%` }} /></div>
      </div>

      <p className={`qh-quiz-card__deadline ${quiz.dueDate ? "qh-quiz-card__deadline--dated" : ""}`}>
        <i className={`bi ${quiz.dueDate ? "bi-calendar-x" : "bi-infinity"}`} /> {quiz.dueDate ? `Hạn: ${formatDateTime(quiz.dueDate)}` : "Không giới hạn thời gian"}
      </p>

      <div className="qh-quiz-card__action">
        <a href={`/student/quiz/history/${quiz.assigningId}`} className="qh-button qh-quiz-card__history"><i className="bi bi-clock-history" /> Lịch sử</a>
        {availability === "available" && !attemptsExhausted ? (
          <Link to={`/student/quiz/play/${quiz.assigningId}`} className="qh-button qh-button--primary">
            <i className="bi bi-pencil-square" /> {quiz.hasUnfinished ? "Tiếp tục" : "Làm bài"}
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            {availability === "not_started" ? "Sắp tới" : availability === "expired" ? "Hết hạn" : "Hết lượt"}
          </Button>
        )}
      </div>
      {quiz.classroomName && <p className="qh-quiz-card__class"><i className="bi bi-mortarboard-fill" /> {quiz.classroomName}</p>}
    </Card>
  );
}
