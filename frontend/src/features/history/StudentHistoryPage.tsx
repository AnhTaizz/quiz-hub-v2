import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { studentApi } from "@/api/student.api";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { PracticeHistoryPanel } from "@/features/practice/PracticeHistoryPanel";
import "./StudentHistoryPage.css";
import { formatDateTime } from "@/utils/format";

const PAGE_SIZE = 10;

type Tab = "quiz" | "practice";

export function StudentHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get("tab") === "practice" ? "practice" : "quiz";

  function selectTab(next: Tab) {
    setSearchParams(next === "quiz" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div className="qh-history-page">
      <div className="qh-history-toolbar">
        <div className="qh-history-heading">
          <span>HISTORY</span>
          <h1>Lịch sử làm bài</h1>
          <p>Theo dõi kết quả bài thi và các lượt tự luyện tập của bạn.</p>
        </div>

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
          <i className="bi bi-file-earmark-check" /> Bài thi &amp; Bài tập
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
          <i className="bi bi-pencil-square" /> Bài tự luyện tập
        </button>
        </div>
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
      {isLoading && <Spinner label="Đang tải lịch sử" />}
      {isError && <ErrorState message="Không thể tải lịch sử làm bài." onRetry={() => void refetch()} />}

      {data && data.content.length === 0 && (
        <div className="qh-history-empty">
          <svg aria-hidden="true" viewBox="0 0 64 64">
            <path d="M17 8h28a7 7 0 0 1 7 7v34a7 7 0 0 1-7 7H17a7 7 0 0 1-7-7V15a7 7 0 0 1 7-7Z" />
            <path d="M10 19H6m4 12H6m4 12H6M27 25l14 14m0-14L27 39" />
          </svg>
          <h2>Chưa có lịch sử làm bài</h2>
          <p>Bạn chưa hoàn thành bất kỳ bài thi nào.</p>
          <Link to="/student/quizzes">Đến bài thi của tôi</Link>
        </div>
      )}

      {data && data.content.length > 0 && (
        <div className={`qh-history-list ${isPlaceholderData ? "qh-history-list--refreshing" : ""}`}>
          {data.content.map((item) => (
            <Card key={item.attemptId} className="qh-history-item">
              <span className={`qh-history-item__badge ${item.result >= 8 ? "is-high" : item.result >= 5 ? "is-mid" : "is-low"}`}>{item.result}</span>
              <div className="qh-history-item__main">
                <p className="qh-history-item__title">
                  {item.quizTitle}
                </p>
                <p className="qh-history-item__meta"><span>{item.classroomName || "Đề thi cá nhân"}</span> <i className="bi bi-calendar3" /> {formatDateTime(item.startedAt)}</p>
              </div>
              <Link className="qh-history-item__view" to={`/student/quiz/result/${item.attemptId}`}>Xem chi tiết <i className="bi bi-chevron-right" /></Link>
            </Card>
          ))}
        </div>
      )}

      {data && <Pagination page={data.number} totalPages={data.totalPages} onPageChange={setPage} />}
    </>
  );
}
