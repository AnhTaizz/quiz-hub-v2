import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/auth/AuthProvider";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useDashboard } from "./useAssignedQuizzes";
import "./StudentDashboardPage.css";

const MINUTE_IN_MS = 60_000;

export function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboard();

  useEffect(() => {
    document.title = "QuizHub | Bảng điều khiển Học sinh";
  }, []);

  return (
    <div className="qh-dashboard">
      {isLoading && <Spinner label="Đang tải trang chủ" />}
      {isError && (
        <ErrorState
          message="Không thể tải trang chủ của bạn."
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          <section className="qh-dashboard__hero" aria-labelledby="dashboard-greeting">
            <div className="qh-dashboard__blob qh-dashboard__blob--purple" aria-hidden="true" />
            <div className="qh-dashboard__blob qh-dashboard__blob--cyan" aria-hidden="true" />

            <div className="qh-dashboard__hero-layout">
              <div className="qh-dashboard__hero-copy">
                <h1 id="dashboard-greeting" className="qh-dashboard__title">
                  <span className="qh-dashboard__greeting">{data.greeting}</span>,{" "}
                  <span className="qh-dashboard__student-identity">
                    <span className="qh-dashboard__student-name">
                      {user?.fullName?.trim() || "Học sinh"}
                    </span>{" "}
                    <span aria-hidden="true">👋</span>
                  </span>
                </h1>
                <p className="qh-dashboard__subtitle">
                  Mọi thứ đang đi đúng hướng! Bạn có{" "}
                  <strong>{data.pendingThisWeekCount ?? 0}</strong> bài kiểm tra sắp đến hạn trong tuần này. Hãy hoàn
                  thành sớm để giữ vững phong độ nhé.
                </p>

                <ul className="qh-dashboard__stats" aria-label="Thống kê học tập">
                  <li className="qh-dashboard__stat">
                    <i className="bi bi-check2-circle qh-dashboard__stat-icon--completed" aria-hidden="true" />
                    Đã làm: <strong>{data.totalCompleted ?? 0}</strong> Bài thi
                  </li>
                  <li className="qh-dashboard__stat">
                    <i className="bi bi-graph-up qh-dashboard__stat-icon--practice" aria-hidden="true" />
                    TB Luyện tập: <strong>{data.practiceAvg != null ? data.practiceAvg.toFixed(1) : "0.0"}</strong>
                  </li>
                  <li className="qh-dashboard__stat">
                    <i className="bi bi-award qh-dashboard__stat-icon--quiz" aria-hidden="true" />
                    TB Kiểm tra: <strong>{data.quizAvg != null ? data.quizAvg.toFixed(1) : "0.0"}</strong>
                  </li>
                </ul>
              </div>

              <DashboardClock />
            </div>
          </section>

          <div className="qh-dashboard__content-grid">
            <section className="qh-dashboard__pending" aria-labelledby="pending-quizzes-title">
              <div className="qh-dashboard__section-header">
                <div>
                  <span className="qh-dashboard__section-label qh-dashboard__section-label--task">Nhiệm vụ</span>
                  <h2 id="pending-quizzes-title" className="qh-dashboard__section-title">
                    Bài thi đang chờ
                  </h2>
                </div>
                <Link to="/student/quizzes" className="qh-dashboard__view-all">
                  Xem tất cả <i className="bi bi-arrow-right" aria-hidden="true" />
                </Link>
              </div>

              {data.assignedQuizzes.length === 0 ? (
                <div className="qh-dashboard__empty">
                  <i className="bi bi-emoji-smile" aria-hidden="true" />
                  <p>Tuyệt vời! Bạn không còn bài thi nào đang chờ.</p>
                </div>
              ) : (
                <div className="qh-dashboard__tasks">
                  {data.assignedQuizzes.map((quiz) => (
                    <AssignedQuizCard key={quiz.assigningId} quiz={quiz} variant="task" />
                  ))}
                </div>
              )}
            </section>

            <aside className="qh-dashboard__quick-column" aria-labelledby="quick-actions-title">
              <span className="qh-dashboard__section-label qh-dashboard__section-label--personal">Cá nhân</span>
              <h2 id="quick-actions-title" className="qh-dashboard__section-title">
                Thao tác nhanh
              </h2>
              <div className="qh-dashboard__quick-card">
                <a href="/student/categories?type=public" className="qh-dashboard__quick-action">
                  <i className="bi bi-globe2 qh-dashboard__quick-icon--practice" aria-hidden="true" />
                  Luyện tập nhanh
                </a>
                <a href="/student/categories?type=mine" className="qh-dashboard__quick-action">
                  <i className="bi bi-journals qh-dashboard__quick-icon--library" aria-hidden="true" />
                  Đề thi của tôi
                </a>
                <a href="/student/quiz/ai-create" className="qh-dashboard__quick-action">
                  <i className="bi bi-robot qh-dashboard__quick-icon--ai" aria-hidden="true" />
                  Tạo đề thi bằng AI
                </a>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;
    const delayUntilNextMinute = MINUTE_IN_MS - (Date.now() % MINUTE_IN_MS);
    const timeoutId = window.setTimeout(() => {
      setNow(new Date());
      intervalId = window.setInterval(() => setNow(new Date()), MINUTE_IN_MS);
    }, delayUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const hours24 = now.getHours();
  const hour = String(hours24 % 12 || 12).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const longDate = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const accessibleTime = `Thời gian hiện tại: ${hour}:${minute} ${period}, ${longDate}`;

  return (
    <time className="qh-dashboard-clock" dateTime={now.toISOString()} aria-label={accessibleTime}>
      <span className="qh-dashboard-clock__time" aria-hidden="true">
        <span data-testid="clock-hour">{hour}</span>
        <span className="qh-dashboard-clock__colon">:</span>
        <span data-testid="clock-minute">{minute}</span>
        <span className="qh-dashboard-clock__period" data-testid="clock-period">
          {period}
        </span>
      </span>
      <span className="qh-dashboard-clock__date" data-testid="clock-date">
        {longDate}
      </span>
    </time>
  );
}
