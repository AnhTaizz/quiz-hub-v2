import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/api/student.api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { PracticeHistoryPanel } from "@/features/practice/PracticeHistoryPanel";
import "./StudentHistoryPage.css";

const PAGE_SIZE = 10;

type Tab = "quiz" | "practice";

export function StudentHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "practice" ? "practice" : "quiz";

  function selectTab(next: Tab) {
    setSearchParams(next === "quiz" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div>
      <PageHeader title="History" />

      <div className="qh-history-tabs" role="tablist" aria-label="History type">
        <button
          type="button"
          role="tab"
          id="history-tab-quiz"
          aria-selected={tab === "quiz"}
          aria-controls="history-panel-quiz"
          tabIndex={tab === "quiz" ? 0 : -1}
          className={`qh-history-tab ${tab === "quiz" ? "qh-history-tab--active" : ""}`}
          onClick={() => selectTab("quiz")}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") selectTab("practice");
          }}
        >
          Quizzes
        </button>
        <button
          type="button"
          role="tab"
          id="history-tab-practice"
          aria-selected={tab === "practice"}
          aria-controls="history-panel-practice"
          tabIndex={tab === "practice" ? 0 : -1}
          className={`qh-history-tab ${tab === "practice" ? "qh-history-tab--active" : ""}`}
          onClick={() => selectTab("practice")}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") selectTab("quiz");
          }}
        >
          Practice
        </button>
      </div>

      {tab === "quiz" ? (
        <div role="tabpanel" id="history-panel-quiz" aria-labelledby="history-tab-quiz">
          <QuizHistoryPanel />
        </div>
      ) : (
        <div role="tabpanel" id="history-panel-practice" aria-labelledby="history-tab-practice">
          <PracticeHistoryPanel />
        </div>
      )}
    </div>
  );
}

function QuizHistoryPanel() {
  const [page, setPage] = useState(0);

  // Backend-paginated (see StudentQuizRestController#getQuizHistoryPage) -
  // only the current page is ever fetched, never the full history.
  const { data, isLoading, isError, refetch, isPlaceholderData } = useQuery({
    queryKey: ["student", "history", page, PAGE_SIZE],
    queryFn: ({ signal }) => studentApi.getHistoryPage(page, PAGE_SIZE, signal),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      {isLoading && <Spinner label="Loading history" />}
      {isError && <ErrorState message="Could not load your history." onRetry={() => void refetch()} />}

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
    </>
  );
}
