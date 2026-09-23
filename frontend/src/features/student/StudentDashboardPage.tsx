import { useAuth } from "@/auth/AuthProvider";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useDashboard } from "./useAssignedQuizzes";
import "./StudentDashboardPage.css";

export function StudentDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useDashboard();

  return (
    <div className="qh-legacy-dashboard">

      {isLoading && <Spinner label="Đang tải trang chủ" />}
      {isError && <ErrorState message="Không thể tải trang chủ của bạn." onRetry={() => refetch()} />}

      {data && (
        <>
          <section className="qh-dashboard-hero">
            <div className="qh-dashboard-blob qh-dashboard-blob--one" />
            <div className="qh-dashboard-blob qh-dashboard-blob--two" />
            <div className="qh-dashboard-hero__copy">
              <h1>{data.greeting}, <span>{user?.fullName ?? "Học sinh"}</span> 👋</h1>
              <p>Mọi thứ đang đi đúng hướng! Bạn có <strong>{data.pendingThisWeekCount}</strong> bài kiểm tra sắp đến hạn trong tuần này. Hãy hoàn thành sớm để giữ vững phong độ nhé.</p>
              <div className="qh-dashboard-hero__stats">
                <span><i className="bi bi-check2-circle" /> Đã làm: <strong>{data.totalCompleted}</strong> Bài thi</span>
                <span><i className="bi bi-graph-up" /> TB Luyện tập: <strong>{data.practiceAvg?.toFixed(1) ?? "0.0"}</strong></span>
                <span><i className="bi bi-award" /> TB Kiểm tra: <strong>{data.quizAvg?.toFixed(1) ?? "0.0"}</strong></span>
              </div>
            </div>
            <DashboardClock />
          </section>

          <div className="qh-dashboard-columns">
            <section>
              <div className="qh-dashboard-heading">
                <div><span>Nhiệm vụ</span><h2>Bài thi đang chờ</h2></div>
                <Link to="/student/quizzes">Xem tất cả <i className="bi bi-arrow-right" /></Link>
              </div>
              {data.assignedQuizzes.length === 0 ? (
                <div className="qh-dashboard-empty">
                  <i className="bi bi-emoji-smile" />
                  <p>Tuyệt vời! Bạn không còn bài thi nào đang chờ.</p>
                </div>
              ) : data.assignedQuizzes.map((quiz) => (
                <AssignedQuizCard key={quiz.assigningId} quiz={quiz} variant="task" />
              ))}
            </section>

            <aside>
              <div className="qh-dashboard-heading">
                <div><span className="qh-dashboard-heading__personal">Cá nhân</span><h2>Thao tác nhanh</h2></div>
              </div>
              <div className="qh-dashboard-quick">
                <a href="/student/categories?type=public"><i className="bi bi-globe2" /> Luyện tập nhanh</a>
                <a href="/student/categories?type=mine"><i className="bi bi-journals" /> Đề thi của tôi</a>
                <a href="/student/quiz/ai-create"><i className="bi bi-robot" /> Tạo đề thi bằng AI</a>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function DashboardClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="qh-dashboard-clock" aria-label="Thời gian hiện tại">
      <div>{now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false })}</div>
      <span>{now.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
    </div>
  );
}
