import { useMemo, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useAssignedQuizzes } from "./useAssignedQuizzes";
import "./StudentQuizListPage.css";

export function StudentQuizListPage() {
  const { data, isLoading, isError, refetch } = useAssignedQuizzes();
  const [query, setQuery] = useState("");
  const [classroom, setClassroom] = useState("all");
  const classrooms = useMemo(() => [...new Set((data ?? []).map((quiz) => quiz.classroomName).filter(Boolean))] as string[], [data]);
  const filtered = useMemo(() => (data ?? []).filter((quiz) => {
    const matchesName = (quiz.quizTitle ?? "").toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi"));
    return matchesName && (classroom === "all" || quiz.classroomName === classroom);
  }), [data, query, classroom]);

  return (
    <div className="qh-quiz-list-page">
      <section className="qh-quiz-list-hero">
        <div>
          <div className="qh-quiz-list-hero__title"><h1>Bài thi <span>của tôi</span></h1><b>{data?.length ?? 0} bài thi</b></div>
          <p>Tổng hợp tất cả bài tập từ các lớp học của bạn. Bạn có thể tìm kiếm theo tên hoặc lọc theo lớp học bên dưới.</p>
        </div>
      </section>

      <div className="qh-quiz-filter">
        <label><i className="bi bi-search" /><span className="visually-hidden">Tìm kiếm bài thi</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm tên bài thi..." /></label>
        <select aria-label="Lọc theo lớp học" value={classroom} onChange={(e) => setClassroom(e.target.value)}>
          <option value="all">Tất cả lớp học</option>
          {classrooms.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>

      {isLoading && <Spinner label="Đang tải bài thi" />}
      {isError && <ErrorState message="Không thể tải danh sách bài thi." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState
          title="Bạn chưa có bài thi nào"
          description="Hãy tham gia lớp học để nhận bài thi từ giáo viên."
        />
      )}

      {data && data.length > 0 && filtered.length === 0 && <EmptyState title="Không tìm thấy bài thi phù hợp" />}

      {filtered.length > 0 && (
        <div className="qh-quiz-list-grid">
          {filtered.map((quiz) => (
            <AssignedQuizCard key={quiz.assigningId} quiz={quiz} />
          ))}
        </div>
      )}
    </div>
  );
}
