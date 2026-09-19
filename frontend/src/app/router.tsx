import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Routes, Route } from "react-router";
import { RequireAuth } from "@/auth/RequireAuth";
import { RequireRole } from "@/auth/RequireRole";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/Spinner";
import { LandingPage } from "@/features/auth/LandingPage";

// Route-level code splitting: the quiz player, dashboard and history each
// load on demand instead of shipping in one bundle.
const LoginPage = lazy(() => import("@/features/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/features/auth/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })),
);
const OAuth2RedirectPage = lazy(() =>
  import("@/features/auth/OAuth2RedirectPage").then((m) => ({ default: m.OAuth2RedirectPage })),
);
const StudentDashboardPage = lazy(() =>
  import("@/features/student/StudentDashboardPage").then((m) => ({ default: m.StudentDashboardPage })),
);
const StudentQuizListPage = lazy(() =>
  import("@/features/student/StudentQuizListPage").then((m) => ({ default: m.StudentQuizListPage })),
);
const StudentClassroomListPage = lazy(() =>
  import("@/features/classroom/StudentClassroomListPage").then((m) => ({ default: m.StudentClassroomListPage })),
);
const StudentClassroomDetailPage = lazy(() =>
  import("@/features/classroom/StudentClassroomDetailPage").then((m) => ({ default: m.StudentClassroomDetailPage })),
);
const StudentHistoryPage = lazy(() =>
  import("@/features/history/StudentHistoryPage").then((m) => ({ default: m.StudentHistoryPage })),
);
const QuizPlayByAssigningPage = lazy(() =>
  import("@/features/quiz/QuizPlayPage").then((m) => ({ default: m.QuizPlayByAssigningPage })),
);
const QuizPlayByAttemptPage = lazy(() =>
  import("@/features/quiz/QuizPlayPage").then((m) => ({ default: m.QuizPlayByAttemptPage })),
);
const QuizResultPage = lazy(() => import("@/features/quiz/QuizResultPage").then((m) => ({ default: m.QuizResultPage })));

const OAuth2ChooseRolePage = lazy(() =>
  import("@/features/auth/OAuth2ChooseRolePage").then((m) => ({ default: m.OAuth2ChooseRolePage })),
);
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const PracticeSetupPage = lazy(() =>
  import("@/features/practice/PracticeSetupPage").then((m) => ({ default: m.PracticeSetupPage })),
);
const PracticePlayPage = lazy(() =>
  import("@/features/practice/PracticePlayPage").then((m) => ({ default: m.PracticePlayPage })),
);
const PracticeReviewPage = lazy(() =>
  import("@/features/practice/PracticeReviewPage").then((m) => ({ default: m.PracticeReviewPage })),
);

function StudentOnly({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole role="STUDENT">{children}</RequireRole>
    </RequireAuth>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<Spinner label="Loading page" />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/oauth2-redirect.html" element={<OAuth2RedirectPage />} />
        <Route path="/oauth2-choose-role.html" element={<OAuth2ChooseRolePage />} />

        {/* Any signed-in role (teacher/admin reach it from their legacy headers too), so not student-only. */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />

        <Route
          path="/student"
          element={
            <StudentOnly>
              <AppShell />
            </StudentOnly>
          }
        >
          <Route index element={<StudentDashboardPage />} />
          <Route path="quizzes" element={<StudentQuizListPage />} />
          <Route path="classrooms" element={<StudentClassroomListPage />} />
          <Route path="classrooms/:id" element={<StudentClassroomDetailPage />} />
          <Route path="history" element={<StudentHistoryPage />} />
          <Route path="practice" element={<PracticeSetupPage />} />
          <Route path="practice/review/:id" element={<PracticeReviewPage />} />
          {/* The old server-rendered route pointed at a template that no longer exists. */}
          <Route path="practice-history" element={<Navigate to="/student/history?tab=practice" replace />} />
        </Route>

        {/* Full-screen quiz-taking flow - no dashboard chrome, matching the
            legacy quiz-play page's dedicated layout. */}
        <Route
          path="/student/practice/play"
          element={
            <StudentOnly>
              <PracticePlayPage />
            </StudentOnly>
          }
        />
        <Route
          path="/student/quiz/play/:assigningId"
          element={
            <StudentOnly>
              <QuizPlayByAssigningPage />
            </StudentOnly>
          }
        />
        <Route
          path="/student/quiz/resume/:attemptId"
          element={
            <StudentOnly>
              <QuizPlayByAttemptPage />
            </StudentOnly>
          }
        />
        <Route
          path="/student/quiz/result/:attemptId"
          element={
            <StudentOnly>
              <QuizResultPage />
            </StudentOnly>
          }
        />
      </Routes>
    </Suspense>
  );
}
