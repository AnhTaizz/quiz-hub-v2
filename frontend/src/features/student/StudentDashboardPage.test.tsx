import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { StudentDashboardPage, DashboardClock } from "./StudentDashboardPage";
import { AssignedQuizCard } from "@/features/quiz/AssignedQuizCard";
import { AuthProvider } from "@/auth/AuthProvider";
import { clearSession, setSession } from "@/auth/authStorage";
import { studentApi } from "@/api/student.api";
import type { StudentDashboardResponse } from "@/types/api";

vi.mock("@/api/student.api", () => ({
  studentApi: {
    getDashboard: vi.fn(),
  },
}));

function mockDashboardData(overrides: Partial<StudentDashboardResponse> = {}): StudentDashboardResponse {
  return {
    greeting: "Chào buổi sáng",
    totalCompleted: 12,
    practiceAvg: 8.5,
    quizAvg: 9.2,
    pendingCount: 2,
    pendingThisWeekCount: 3,
    assignedQuizzes: [
      {
        assigningId: 101,
        quizId: "q-101",
        quizTitle: "Kiểm tra Toán 12 - Giải tích",
        classroomId: 1,
        classroomName: "Toán 12A1",
        startDate: "2026-09-20T08:00:00",
        dueDate: "2026-09-30T23:59:59",
        durationInMins: 45,
        maxAttempt: 3,
        attemptsMade: 1,
        attemptsLeft: 2,
        hasStarted: true,
        hasUnfinished: false,
        availability: "AVAILABLE",
      },
      {
        assigningId: 102,
        quizId: "q-102",
        quizTitle: "Vật lý 12 - Dao động điều hòa",
        classroomId: 1,
        classroomName: "Vật lý 12A1",
        startDate: "2026-09-20T08:00:00",
        dueDate: "2026-09-28T23:59:59",
        durationInMins: 60,
        maxAttempt: 1,
        attemptsMade: 1,
        attemptsLeft: 0,
        hasStarted: true,
        hasUnfinished: true,
        availability: "AVAILABLE",
      },
    ],
    ...overrides,
  };
}

function renderStudentDashboard(initialEntries = ["/student"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/student" element={<StudentDashboardPage />} />
            <Route path="/student/quizzes" element={<div>Quiz List Page</div>} />
            <Route path="/student/quiz/play/:id" element={<div>Quiz Play Page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("StudentDashboardPage Component - V1 Parity and Dashboard Behavior", () => {
  beforeEach(() => {
    clearSession();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearSession();
    vi.useRealTimers();
  });

  it("1. displays spinner while loading dashboard data", () => {
    vi.mocked(studentApi.getDashboard).mockReturnValue(new Promise(() => {}));
    renderStudentDashboard();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Đang tải trang chủ")).toBeInTheDocument();
  });

  it("2. displays error state on API failure and retries on button click", async () => {
    vi.mocked(studentApi.getDashboard).mockRejectedValueOnce(new Error("Network Error"));
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Không thể tải trang chủ của bạn.")).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole("button", { name: /Retry|Thử lại/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(studentApi.getDashboard).mockResolvedValueOnce(mockDashboardData());
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText("Bài thi đang chờ")).toBeInTheDocument();
    });
  });

  it("3. renders hero section with greeting, user name, and weekly pending message", async () => {
    setSession("token-student", {
      id: 1,
      email: "student@example.com",
      fullName: "Nguyễn Văn A",
      role: "STUDENT",
      avatarUrl: null,
    });
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Chào buổi sáng")).toBeInTheDocument();
    });

    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(
      screen.getByText(/Mọi thứ đang đi đúng hướng! Bạn có/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("4. falls back to 'Học sinh' when user fullName is not present", async () => {
    setSession("token-student", {
      id: 1,
      email: "student@example.com",
      fullName: "",
      role: "STUDENT",
      avatarUrl: null,
    });
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Học sinh")).toBeInTheDocument();
    });
  });

  it("5. renders the three hero stat glass pills correctly", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(
      mockDashboardData({
        totalCompleted: 25,
        practiceAvg: 9.4,
        quizAvg: 8.8,
      }),
    );
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("25")).toBeInTheDocument();
    });

    expect(screen.getByText("9.4")).toBeInTheDocument();
    expect(screen.getByText("8.8")).toBeInTheDocument();
    expect(screen.getByText(/Đã làm:/i)).toBeInTheDocument();
    expect(screen.getByText(/TB Luyện tập:/i)).toBeInTheDocument();
    expect(screen.getByText(/TB Kiểm tra:/i)).toBeInTheDocument();
  });

  it("6. renders '0.0' fallback when averages are null", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(
      mockDashboardData({
        practiceAvg: null,
        quizAvg: null,
      }),
    );
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getAllByText("0.0").length).toBe(2);
    });
  });

  it("7. renders typographic clock with 12-hour AM/PM format and Vietnamese date", () => {
    const fixedDate = new Date("2026-09-25T08:35:00");
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    render(<DashboardClock />);

    expect(screen.getByTestId("clock-hour")).toHaveTextContent("08");
    expect(screen.getByTestId("clock-minute")).toHaveTextContent("35");
    expect(screen.getByTestId("clock-period")).toHaveTextContent("AM");
    expect(screen.getByTestId("clock-date")).toHaveTextContent(/thứ/i);
    expect(screen.getByTestId("clock-date")).toHaveTextContent(/25 tháng 9, 2026/i);
    expect(screen.getByLabelText(/Thời gian hiện tại: 08:35 AM/i)).toBeInTheDocument();
  });

  it("8. clock formats PM hours correctly in 12-hour format", () => {
    const fixedDate = new Date("2026-09-25T20:15:00");
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);

    render(<DashboardClock />);

    expect(screen.getByTestId("clock-hour")).toHaveTextContent("08");
    expect(screen.getByTestId("clock-minute")).toHaveTextContent("15");
    expect(screen.getByTestId("clock-period")).toHaveTextContent("PM");
  });

  it("9. updates at the next minute, then every minute, and cleans up both timers", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T08:35:30"));
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(<DashboardClock />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId("clock-minute")).toHaveTextContent("36");
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60_000);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("clock-minute")).toHaveTextContent("37");

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("10. renders assigned pending quiz cards with duration, attempts, and due date", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Kiểm tra Toán 12 - Giải tích")).toBeInTheDocument();
    });

    expect(screen.getByText(/45 phút/i)).toBeInTheDocument();
    expect(screen.getByText(/60 phút/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lượt:/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.queryByText(/\d+ câu/i)).not.toBeInTheDocument();
  });

  it("11. displays empty state when there are no assigned quizzes", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(
      mockDashboardData({
        assignedQuizzes: [],
      }),
    );
    renderStudentDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Tuyệt vời! Bạn không còn bài thi nào đang chờ."),
      ).toBeInTheDocument();
    });
  });

  it("12. provides 'Xem tất cả' link that navigates to /student/quizzes", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Xem tất cả/i })).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /Xem tất cả/i });
    expect(link).toHaveAttribute("href", "/student/quizzes");
  });

  it("13. renders Quick Actions with exact V1 href destinations and icons", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Thao tác nhanh")).toBeInTheDocument();
    });

    const practiceLink = screen.getByRole("link", { name: /Luyện tập nhanh/i });
    expect(practiceLink).toHaveAttribute("href", "/student/categories?type=public");

    const myQuizzesLink = screen.getByRole("link", { name: /Đề thi của tôi/i });
    expect(myQuizzesLink).toHaveAttribute("href", "/student/categories?type=mine");

    const aiCreateLink = screen.getByRole("link", { name: /Tạo đề thi bằng AI/i });
    expect(aiCreateLink).toHaveAttribute("href", "/student/quiz/ai-create");
  });

  it("14. renders 'Tiếp tục' button for unfinished attempt and 'Làm bài' for fresh attempt", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(
      mockDashboardData({
        assignedQuizzes: [
          {
            assigningId: 201,
            quizId: "q-201",
            quizTitle: "Đề thi đang làm dở",
            classroomId: 1,
            classroomName: "Lớp A",
            startDate: null,
            dueDate: null,
            durationInMins: 30,
            maxAttempt: 2,
            attemptsMade: 1,
            attemptsLeft: 1,
            hasStarted: true,
            hasUnfinished: true,
            availability: "AVAILABLE",
          },
          {
            assigningId: 202,
            quizId: "q-202",
            quizTitle: "Đề thi mới chưa làm",
            classroomId: 1,
            classroomName: "Lớp A",
            startDate: null,
            dueDate: null,
            durationInMins: 30,
            maxAttempt: 2,
            attemptsMade: 0,
            attemptsLeft: 2,
            hasStarted: false,
            hasUnfinished: false,
            availability: "AVAILABLE",
          },
        ],
      }),
    );
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Đề thi đang làm dở")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Tiếp tục/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Làm bài/i })).toBeInTheDocument();
  });

  it("15. renders disabled status badge when quiz is expired, not started, or attempts exhausted", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(
      mockDashboardData({
        assignedQuizzes: [
          {
            assigningId: 301,
            quizId: "q-301",
            quizTitle: "Đề thi chưa mở",
            classroomId: 1,
            classroomName: "Lớp A",
            startDate: "2026-10-01T00:00:00",
            dueDate: "2026-10-10T00:00:00",
            durationInMins: 45,
            maxAttempt: 1,
            attemptsMade: 0,
            attemptsLeft: 1,
            hasStarted: false,
            hasUnfinished: false,
            availability: "NOT_STARTED",
          },
          {
            assigningId: 302,
            quizId: "q-302",
            quizTitle: "Đề thi đã hết hạn",
            classroomId: 1,
            classroomName: "Lớp A",
            startDate: "2026-09-01T00:00:00",
            dueDate: "2026-09-10T00:00:00",
            durationInMins: 45,
            maxAttempt: 1,
            attemptsMade: 0,
            attemptsLeft: 1,
            hasStarted: false,
            hasUnfinished: false,
            availability: "EXPIRED",
          },
          {
            assigningId: 303,
            quizId: "q-303",
            quizTitle: "Đề thi đã hết lượt",
            classroomId: 1,
            classroomName: "Lớp A",
            startDate: null,
            dueDate: null,
            durationInMins: 45,
            maxAttempt: 1,
            attemptsMade: 1,
            attemptsLeft: 0,
            hasStarted: true,
            hasUnfinished: false,
            availability: "AVAILABLE",
          },
        ],
      }),
    );
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Đề thi chưa mở")).toBeInTheDocument();
    });

    expect(screen.getByText("Sắp tới")).toBeInTheDocument();
    expect(screen.getByText("Hết hạn")).toBeInTheDocument();
    expect(screen.getByText("Hết lượt")).toBeInTheDocument();
  });

  it("16. history link points to /student/quiz/history/:assigningId", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Kiểm tra Toán 12 - Giải tích")).toBeInTheDocument();
    });

    const historyLinks = screen.getAllByRole("link", { name: /Lịch sử/i });
    expect(historyLinks[0]).toHaveAttribute("href", "/student/quiz/history/101");
  });

  it("17. play link points to /student/quiz/play/:assigningId", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Kiểm tra Toán 12 - Giải tích")).toBeInTheDocument();
    });

    const playLink = screen.getByRole("link", { name: /Làm bài/i });
    expect(playLink).toHaveAttribute("href", "/student/quiz/play/101");
  });

  it("18. AssignedQuizCard variant='card' regression check renders card layout with badge and facts", () => {
    const quiz = mockDashboardData().assignedQuizzes[0]!;
    const { container } = render(
      <MemoryRouter>
        <AssignedQuizCard quiz={quiz} variant="card" />
      </MemoryRouter>,
    );

    expect(container.querySelector(".qh-quiz-card")).toBeInTheDocument();
    expect(screen.getByText("Đang mở")).toBeInTheDocument();
    expect(screen.getByText("Thời gian")).toBeInTheDocument();
    expect(screen.getByText("Tiến độ lượt làm")).toBeInTheDocument();
  });

  it("19. sets document title on mount", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(document.title).toBe("QuizHub | Bảng điều khiển Học sinh");
    });
  });

  it("20. renders decorative blobs with aria-hidden in hero section", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    const { container } = renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Chào buổi sáng")).toBeInTheDocument();
    });

    const blob1 = container.querySelector(".qh-dashboard__blob--purple");
    const blob2 = container.querySelector(".qh-dashboard__blob--cyan");
    expect(blob1).toBeInTheDocument();
    expect(blob2).toBeInTheDocument();
    expect(blob1).toHaveAttribute("aria-hidden", "true");
    expect(blob2).toHaveAttribute("aria-hidden", "true");
  });

  it("21. renders section labels and titles for both columns", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    renderStudentDashboard();

    await waitFor(() => {
      expect(screen.getByText("Nhiệm vụ")).toBeInTheDocument();
    });

    expect(screen.getByText("Cá nhân")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Bài thi đang chờ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Thao tác nhanh" })).toBeInTheDocument();
  });

  it("22. exposes scoped layout hooks used by the desktop and mobile CSS breakpoints", async () => {
    vi.mocked(studentApi.getDashboard).mockResolvedValue(mockDashboardData());
    const { container } = renderStudentDashboard();

    await screen.findByRole("heading", { name: "Bài thi đang chờ" });

    expect(container.querySelector(".qh-dashboard__content-grid")).toBeInTheDocument();
    expect(container.querySelector(".qh-task-card__layout")).toBeInTheDocument();
    expect(container.querySelector(".qh-task-card__actions")).toBeInTheDocument();
    expect(container.querySelector(".qh-dashboard__quick-column")).toBeInTheDocument();
  });
});
