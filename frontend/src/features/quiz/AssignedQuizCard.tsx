import { Link } from "react-router";
import type { AssignedQuizSummary } from "@/types/api";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getQuizAvailability, formatAttemptsLeft } from "./quizAvailability";
import "./AssignedQuizCard.css";

export function AssignedQuizCard({ quiz }: { quiz: AssignedQuizSummary }) {
  const availability = getQuizAvailability(quiz);
  const attemptsExhausted = quiz.attemptsLeft === 0;

  return (
    <Card className="qh-quiz-card">
      <div className="qh-quiz-card__header">
        <h3 className="qh-quiz-card__title">{quiz.quizTitle ?? "Untitled quiz"}</h3>
        {availability === "not_started" && <Badge tone="warning">Not started</Badge>}
        {availability === "expired" && <Badge tone="danger">Expired</Badge>}
        {availability === "available" && quiz.hasUnfinished && <Badge tone="warning">In progress</Badge>}
      </div>

      {quiz.classroomName && <p className="qh-quiz-card__meta">{quiz.classroomName}</p>}

      <dl className="qh-quiz-card__facts">
        {quiz.durationInMins != null && (
          <div>
            <dt>Duration</dt>
            <dd>{quiz.durationInMins} min</dd>
          </div>
        )}
        <div>
          <dt>Attempts</dt>
          <dd>{formatAttemptsLeft(quiz)}</dd>
        </div>
      </dl>

      <div className="qh-quiz-card__action">
        {availability === "available" && !attemptsExhausted ? (
          <Link to={`/student/quiz/play/${quiz.assigningId}`} className="qh-button qh-button--primary">
            {quiz.hasUnfinished ? "Resume quiz" : "Start quiz"}
          </Link>
        ) : (
          <Button variant="secondary" disabled>
            {availability === "not_started" ? "Not yet available" : availability === "expired" ? "Deadline passed" : "No attempts left"}
          </Button>
        )}
      </div>
    </Card>
  );
}
