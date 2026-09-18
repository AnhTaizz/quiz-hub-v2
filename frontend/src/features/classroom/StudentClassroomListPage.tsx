import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { PageHeader } from "@/components/layout/PageHeader";
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
import "./Classroom.css";

export function StudentClassroomListPage() {
  const { data, isLoading, isError, refetch } = useClassroomList();
  const joinMutation = useJoinClassroom();
  const [code, setCode] = useState("");
  const { showToast } = useToast();

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return;
    joinMutation.mutate(code.trim(), {
      onSuccess: (message) => {
        showToast(message, "success");
        setCode("");
      },
      onError: (error) => {
        showToast(isApiError(error) ? error.message : "Could not join classroom.", "error");
      },
    });
  }

  return (
    <div>
      <PageHeader title="Your classrooms" />

      <Card className="qh-join-card">
        <form onSubmit={handleJoin} className="qh-join-form">
          <Input
            label="Classroom code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. AB12CD"
          />
          <Button type="submit" isLoading={joinMutation.isPending}>
            Join classroom
          </Button>
        </form>
      </Card>

      {isLoading && <Spinner label="Loading classrooms" />}
      {isError && <ErrorState message="Could not load your classrooms." onRetry={() => refetch()} />}

      {data && data.length === 0 && (
        <EmptyState title="You haven't joined any classroom yet" description="Ask your teacher for a classroom code." />
      )}

      {data && data.length > 0 && (
        <div className="qh-classroom-grid">
          {data.map((classroom) => (
            <Card key={classroom.id} className="qh-classroom-card">
              <div className="qh-classroom-card__header">
                <h3>{classroom.name}</h3>
                {classroom.joinStatus === "PENDING" && <Badge tone="warning">Pending approval</Badge>}
                {classroom.joinStatus === "REJECTED" && <Badge tone="danger">Rejected</Badge>}
              </div>
              {classroom.teacherName && <p className="qh-classroom-card__meta">By {classroom.teacherName}</p>}
              {classroom.joinStatus === "APPROVED" ? (
                <Link to={`/student/classrooms/${classroom.id}`} className="qh-button qh-button--secondary">
                  Open classroom
                </Link>
              ) : (
                <Button variant="secondary" disabled>
                  Awaiting approval
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
