import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { quizApi } from "@/api/quiz.api";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import "./QuizResultPage.css";

export function QuizResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const id = Number(attemptId);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["quiz", "result", id],
    queryFn: ({ signal }) => quizApi.getResult(id, signal),
    enabled: Number.isFinite(id),
  });

  if (isLoading) return <Spinner label="Đang tải kết quả" />;
  if (isError || !data) return <ErrorState message="Không thể tải kết quả bài thi." onRetry={() => refetch()} />;

  return (
    <div className="qh-result-page">
      <section className="qh-result-hero">
        <Link to="/student/history" className="qh-result-hero__back"><i className="bi bi-arrow-left" /> Quay lại lịch sử</Link>
        <span className="qh-result-hero__eyebrow">KẾT QUẢ BÀI THI</span>
        <h1>{data.quizTitle}</h1>
        <div className="qh-result-hero__score"><strong>{data.score}</strong><span>Điểm số</span></div>
      </section>

      <div className="qh-result-summary">
        <Card>
          <p className="qh-result-summary__value">{data.correctNum}</p>
          <p className="qh-result-summary__label">Câu đúng</p>
        </Card>
        <Card>
          <p className="qh-result-summary__value">{data.incorrectNum}</p>
          <p className="qh-result-summary__label">Câu sai</p>
        </Card>
        <Card>
          <p className="qh-result-summary__value">{data.totalNum}</p>
          <p className="qh-result-summary__label">Tổng số câu</p>
        </Card>
      </div>

      <div className="qh-result-questions">
        {data.questions.map((question, index) => (
          <Card key={question.questionId} className="qh-result-question">
            <div className="qh-result-question__header">
              <span>Câu {index + 1}</span>
              {/* Rendered exactly as the backend reports it - the frontend
                  never infers or overrides answer visibility itself. */}
              <Badge tone={question.isCorrect ? "success" : "danger"}>
                {question.isCorrect ? "Chính xác" : "Chưa chính xác"}
              </Badge>
            </div>
            <p className="qh-result-question__text">{question.text}</p>

            {question.selectedText != null && question.selectedText !== "" ? (
              <p className="qh-result-question__your-answer"><b>Câu trả lời của bạn:</b> {question.selectedText}</p>
            ) : (
              <ul className="qh-result-question__answers">
                {question.answers.map((answer) => {
                  const wasSelected = question.selectedAnswerIds.includes(answer.answerId);
                  return (
                    <li
                      key={answer.answerId}
                      className={[
                        "qh-result-answer",
                        wasSelected && "qh-result-answer--selected",
                        answer.isCorrect && "qh-result-answer--correct",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {answer.text}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
