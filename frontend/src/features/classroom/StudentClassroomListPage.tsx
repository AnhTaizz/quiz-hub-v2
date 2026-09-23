import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { isApiError } from "@/api/httpClient";
import { useClassroomList, useJoinClassroom } from "./useClassrooms";
import { formatDate } from "@/utils/format";
import "./Classroom.css";

export function StudentClassroomListPage() {
  const { data, isLoading, isError, refetch } = useClassroomList();
  const joinMutation = useJoinClassroom();
  const [code, setCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(() => window.location.hash === "#join-classroom");
  const { showToast } = useToast();

  useEffect(() => {
    const openFromHash = () => {
      if (window.location.hash === "#join-classroom") setJoinOpen(true);
    };
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    joinMutation.mutate(code.trim(), {
      onSuccess: (message) => {
        showToast(message, "success");
        setCode("");
        setJoinOpen(false);
      },
      onError: (error) => {
        showToast(isApiError(error) ? error.message : "Không thể tham gia lớp học.", "error");
      },
    });
  }

  return (
    <div className="qh-classrooms-page">
      <section className="qh-classrooms-hero">
        <div><h1>Lớp học của tôi</h1><p>Nơi bạn có thể quản lý các lớp học đang tham gia, nộp bài tập và xem kết quả học tập của mình.</p></div>
        <button type="button" onClick={() => setJoinOpen(true)}><i className="bi bi-plus-circle-fill" /> Tham gia lớp học</button>
      </section>

      {isLoading && <Spinner label="Đang tải lớp học" />}
      {isError && <ErrorState message="Không thể tải danh sách lớp học." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState title="Bạn chưa tham gia lớp học nào" description="Nhập mã lớp học từ giáo viên để bắt đầu hành trình học tập của mình." />
      )}

      {data && data.length > 0 && (
        <div className="qh-classroom-grid">
          {data.map((classroom) => (
            <article key={classroom.id} className="qh-classroom-card">
              <div className="qh-classroom-card__banner">
                {classroom.imageUrl ? <img src={classroom.imageUrl} alt="" /> : <div className="qh-classroom-card__cover"><i className="bi bi-mortarboard-fill" /></div>}
                {classroom.joinStatus === "APPROVED" && <Badge tone="success">Đã vào lớp</Badge>}
                {classroom.joinStatus === "PENDING" && <Badge tone="warning">Chờ phê duyệt</Badge>}
                {classroom.joinStatus === "REJECTED" && <Badge tone="danger">Đã từ chối</Badge>}
              </div>
              <div className="qh-classroom-card__body">
                {classroom.teacherName && <p className="qh-classroom-card__teacher"><span>{classroom.teacherName.split(/\s+/).slice(-2).map((part) => part[0]).join("")}</span>{classroom.teacherName}</p>}
                <h3>{classroom.name}</h3>
                <p>{classroom.description || "Không có mô tả cho lớp học này."}</p>
              </div>
              <footer>
                <small><i className="bi bi-clock-history" /> {classroom.joinStatus === "APPROVED" ? "Tham gia" : "Đăng ký"}: {formatDate(classroom.joinedAt)}</small>
                {classroom.joinStatus === "APPROVED" ? <Link to={`/student/classrooms/${classroom.id}`}>Vào lớp <i className="bi bi-arrow-right-short" /></Link> : <b>{classroom.joinStatus === "PENDING" ? "Chờ duyệt" : "Từ chối"}</b>}
              </footer>
            </article>
          ))}
        </div>
      )}

      {joinOpen && (
        <div className="qh-join-modal" role="dialog" aria-modal="true" aria-labelledby="join-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setJoinOpen(false); }}>
          <Card>
            <button className="qh-join-modal__close" type="button" aria-label="Đóng" onClick={() => setJoinOpen(false)}>×</button>
            <h2 id="join-title">Tham gia lớp học</h2>
            <p>Nhập mã lớp được giáo viên cung cấp.</p>
            <form onSubmit={handleJoin} className="qh-join-form">
              <Input label="Mã lớp học" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ví dụ: AB12CD" autoFocus />
              <Button type="submit" isLoading={joinMutation.isPending}>Tham gia lớp</Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
