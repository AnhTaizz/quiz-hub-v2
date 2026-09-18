import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/api/student.api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import "./StudentHistoryPage.css";

const PAGE_SIZE = 10;

export function StudentHistoryPage() {
  const [page, setPage] = useState(0);

  // Backend-paginated (see StudentQuizRestController#getQuizHistoryPage) -
  // only the current page is ever fetched, never the full history.
  const { data, isLoading, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["student", "history", page, PAGE_SIZE],
    queryFn: ({ signal }) => studentApi.getHistoryPage(page, PAGE_SIZE, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <div>
      <PageHeader title="Quiz history" />

      {isLoading && <Spinner label="Loading history" />}
      {isError && <ErrorState message="Could not load your history." onRetry={() => refetch()} />}

      {data && data.content.length === 0 && (
        <EmptyState title="No quiz attempts yet" description="Completed quizzes will show up here." />
      )}

      {data && data.content.length > 0 && (
        <div className={`qh-history-list ${isPlaceholderData ? "qh-history-list--refreshing" : ""}`}>
          {data.content.map((item) => (
            <Card key={item.attemptId} className="qh-history-item">
              <div>
                <p className="qh-history-item__title">
                  <Link to={`/student/quiz/result/${item.attemptId}`}>{item.quizTitle}</Link>
                </p>
                {item.classroomName && <p className="qh-history-item__meta">{item.classroomName}</p>}
              </div>
              <p className="qh-history-item__score">{item.result}</p>
            </Card>
          ))}
        </div>
      )}

      {data && <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  );
}
