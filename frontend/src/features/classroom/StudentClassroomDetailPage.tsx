import { Link, useParams } from "react-router";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { useClassroomDetail } from "./useClassrooms";
import "./Classroom.css";

export function StudentClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classroomId = Number(id);
  const { data, isLoading, isError, refetch } = useClassroomDetail(classroomId);

  if (isLoading) return <Spinner label="Đang tải lớp học" />;
  if (isError) return <ErrorState message="Không thể tải lớp học này." onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <div className="qh-classroom-detail">
      <Link className="qh-classroom-detail__back" to="/student/classrooms"><i className="bi bi-arrow-left" /> Trở về danh sách lớp học</Link>
      <section className="qh-classroom-detail__hero">
        <div><h1>{data.name}</h1><p>{data.description || "Không có mô tả cho lớp học này."}</p></div>
        {data.teacherName && <div className="qh-classroom-detail__teacher"><span>{data.teacherName.split(/\s+/).slice(-2).map((part) => part[0]).join("")}</span><div><small>Giảng viên</small><b>{data.teacherName}</b></div></div>}
      </section>

      <section className="qh-classroom-detail__section">
        <h2><i className="bi bi-tags" /> Chủ đề bài học</h2>
        {data.topics.length === 0 ? <div className="qh-classroom-detail__empty">Chưa có chủ đề bài học nào.</div> : <div className="qh-topic-grid">{data.topics.map((topic) => <article key={topic.id}><div><span>Chủ đề</span><i className="bi bi-folder-fill" /></div><h3>{topic.name}</h3><p>Chủ đề học tập trong lớp này</p></article>)}</div>}
      </section>

      <section className="qh-classroom-detail__section">
        <h2><i className="bi bi-journal-text" /> Đề thi &amp; Bài tập đã giao</h2>

      {data.assignedQuizzes.length === 0 ? (
        <EmptyState title="Hiện tại chưa có đề thi nào được giao trong lớp này" />
      ) : (
        <div className="qh-classroom-grid">
          {data.assignedQuizzes.map((quiz) => (
            <AssignedQuizCard key={quiz.assigningId} quiz={quiz} />
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
