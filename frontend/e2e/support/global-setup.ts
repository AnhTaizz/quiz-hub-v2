import { request, type APIRequestContext, type FullConfig } from "@playwright/test";
import type { E2EFixture } from "./fixture";

// Seeds a deterministic fixture purely through the app's public REST API (no SQL, no real
// accounts): a teacher, a student, an auto-approved classroom, a 2-question quiz
// (single-choice + fill-in) and an assignment the student can start immediately.
// Unique emails per run keep it re-runnable against a database that already has data.

const PASSWORD = "Passw0rd!";

async function json<T>(response: Awaited<ReturnType<APIRequestContext["post"]>>, step: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`E2E seed step "${step}" failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function register(api: APIRequestContext, email: string, role: "TEACHER" | "STUDENT") {
  return json<{ token: string }>(
    await api.post("/api/auth/register", {
      data: { fullName: `E2E ${role}`, email, password: PASSWORD, confirmPassword: PASSWORD, role },
    }),
    `register ${role}`,
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:8080";
  const api = await request.newContext({ baseURL });

  const runId = Date.now().toString(36);
  const teacherEmail = `teacher-${runId}@e2e.test`;
  const studentEmail = `student-${runId}@e2e.test`;
  const quizTitle = `E2E Quiz ${runId}`;

  const teacher = await register(api, teacherEmail, "TEACHER");
  const student = await register(api, studentEmail, "STUDENT");
  const teacherAuth = { Authorization: `Bearer ${teacher.token}` };
  const studentAuth = { Authorization: `Bearer ${student.token}` };

  const classroom = await json<{ id: number; code: string }>(
    await api.post("/api/teacher/classrooms", {
      headers: teacherAuth,
      data: { name: `E2E Class ${runId}`, description: "e2e fixture", requireApproval: false },
    }),
    "create classroom",
  );

  // Plain-text 200 body (not JSON), so check the status directly instead of parsing.
  const join = await api.post(`/api/student/classrooms/join?code=${encodeURIComponent(classroom.code)}`, {
    headers: studentAuth,
  });
  if (!join.ok()) {
    throw new Error(`E2E seed step "student joins classroom" failed: ${join.status()} ${await join.text()}`);
  }

  const q1 = await json<{ id: number }>(
    await api.post("/api/teacher/questions", {
      headers: teacherAuth,
      data: {
        text: "What is 2 + 2?",
        type: "SINGLE_CHOICE",
        level: "EASY",
        answers: [
          { text: "4", isCorrect: true },
          { text: "5", isCorrect: false },
        ],
      },
    }),
    "create single-choice question",
  );

  const q2 = await json<{ id: number }>(
    await api.post("/api/teacher/questions", {
      headers: teacherAuth,
      data: {
        text: "The capital of France is ____",
        type: "FILL_IN_BLANK",
        level: "EASY",
        answers: [{ text: "Paris", isCorrect: true }],
      },
    }),
    "create fill-in question",
  );

  const quiz = await json<{ id: string }>(
    await api.post("/api/teacher/quizzes", {
      headers: teacherAuth,
      data: { title: quizTitle, description: "e2e fixture", isDraft: false, isExam: false, questionIds: [q1.id, q2.id] },
    }),
    "create quiz",
  );

  const assigning = await json<{ id: number }>(
    await api.post("/api/teacher/quiz-assigning", {
      headers: teacherAuth,
      data: {
        classroomId: classroom.id,
        quizId: quiz.id,
        durationInMins: 60,
        maxAttempt: 20,
        showAnswer: true,
        questionShuffled: false,
        answerShuffled: false,
        note: "e2e",
      },
    }),
    "assign quiz",
  );

  // Verify the student really sees it (proves the join was accepted, not just that the call returned).
  const assigned = await json<{ assigningId: number }[]>(
    await api.get("/api/student/quiz/assigned", { headers: studentAuth }),
    "student lists assigned quizzes",
  );
  if (!assigned.some((quiz) => quiz.assigningId === assigning.id)) {
    throw new Error("E2E seed: student cannot see the assigned quiz (classroom join not approved?)");
  }

  const fixture: E2EFixture = {
    student: { email: studentEmail, password: PASSWORD },
    quizTitle,
    assigningId: assigning.id,
  };
  process.env.E2E_FIXTURE = JSON.stringify(fixture);
  await api.dispose();
}
