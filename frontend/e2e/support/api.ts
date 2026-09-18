import { randomUUID } from "node:crypto";
import type { APIRequestContext, APIResponse } from "@playwright/test";

// Builds an isolated "world" for ONE test purely through the app's public REST API
// (no SQL, no repository access, no test-only endpoints): its own teacher, student, classroom,
// a 2-question quiz (single-choice + fill-in) and an assignment the student can start immediately.
// Nothing here is shared between tests, so any spec/test can run alone and in any order.

const PASSWORD = "Passw0rd!";
const MAX_ATTEMPTS = 3; // each test uses at most 2; isolation never relies on a large attempt budget

export interface World {
  student: { email: string; password: string };
  quizTitle: string;
  assigningId: number;
  /** Starts and submits an attempt for this world's student via the API; returns its attemptId. */
  seedSubmittedAttempt: () => Promise<number>;
}

async function readJson<T>(response: APIResponse, step: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`E2E world step "${step}" failed: ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}

async function register(api: APIRequestContext, email: string, role: "TEACHER" | "STUDENT") {
  return readJson<{ token: string }>(
    await api.post("/api/auth/register", {
      data: { fullName: `E2E ${role}`, email, password: PASSWORD, confirmPassword: PASSWORD, role },
    }),
    `register ${role}`,
  );
}

interface TakingQuestion {
  id: number;
  type: string;
  answers: { id: number }[];
}

export async function createWorld(api: APIRequestContext): Promise<World> {
  const id = randomUUID().slice(0, 12);
  const studentEmail = `student-${id}@e2e.test`;
  const quizTitle = `E2E Quiz ${id}`;

  const teacher = await register(api, `teacher-${id}@e2e.test`, "TEACHER");
  const student = await register(api, studentEmail, "STUDENT");
  const teacherAuth = { Authorization: `Bearer ${teacher.token}` };
  const studentAuth = { Authorization: `Bearer ${student.token}` };

  const classroom = await readJson<{ id: number; code: string }>(
    await api.post("/api/teacher/classrooms", {
      headers: teacherAuth,
      data: { name: `E2E Class ${id}`, description: "e2e", requireApproval: false },
    }),
    "create classroom",
  );

  // Plain-text 200 body (not JSON), so check the status directly.
  const join = await api.post(`/api/student/classrooms/join?code=${encodeURIComponent(classroom.code)}`, {
    headers: studentAuth,
  });
  if (!join.ok()) throw new Error(`E2E world step "join classroom" failed: ${join.status()} ${await join.text()}`);

  const q1 = await readJson<{ id: number }>(
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
  const q2 = await readJson<{ id: number }>(
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

  const quiz = await readJson<{ id: string }>(
    await api.post("/api/teacher/quizzes", {
      headers: teacherAuth,
      data: { title: quizTitle, description: "e2e", isDraft: false, isExam: false, questionIds: [q1.id, q2.id] },
    }),
    "create quiz",
  );

  const assigning = await readJson<{ id: number }>(
    await api.post("/api/teacher/quiz-assigning", {
      headers: teacherAuth,
      data: {
        classroomId: classroom.id,
        quizId: quiz.id,
        durationInMins: 60,
        maxAttempt: MAX_ATTEMPTS,
        showAnswer: true,
        questionShuffled: false,
        answerShuffled: false,
        note: "e2e",
      },
    }),
    "assign quiz",
  );

  // Prove the student really sees it (the join was accepted, not just that the call returned).
  const assigned = await readJson<{ assigningId: number; availability: string }[]>(
    await api.get("/api/student/quiz/assigned", { headers: studentAuth }),
    "student lists assigned quizzes",
  );
  const mine = assigned.find((item) => item.assigningId === assigning.id);
  if (!mine || mine.availability !== "AVAILABLE") {
    throw new Error("E2E world: the student cannot start the assigned quiz");
  }

  async function seedSubmittedAttempt(): Promise<number> {
    const started = await readJson<{ attemptId: number; questions: TakingQuestion[] }>(
      await api.get(`/api/student/quiz/start?assigningId=${assigning.id}`, { headers: studentAuth }),
      "start attempt",
    );

    const answers = started.questions.map((question) =>
      question.type === "FILL_IN_BLANK"
        ? { questionId: question.id, answerIds: [] as number[], selectedText: "Paris", revision: 1 }
        : { questionId: question.id, answerIds: question.answers[0] ? [question.answers[0].id] : [], selectedText: "", revision: 1 },
    );

    for (const answer of answers) {
      const saved = await api.post(
        `/api/student/quiz/save-answer?attemptId=${started.attemptId}&questionId=${answer.questionId}`,
        {
          headers: studentAuth,
          data: {
            answerIds: answer.answerIds.length > 0 ? answer.answerIds : null,
            selectedText: answer.selectedText === "" ? null : answer.selectedText,
            revision: answer.revision,
          },
        },
      );
      if (!saved.ok()) throw new Error(`E2E world step "save answer" failed: ${saved.status()} ${await saved.text()}`);
    }

    const submitted = await readJson<{ id: number }>(
      await api.post("/api/student/quiz/submit", {
        headers: studentAuth,
        data: { attemptId: started.attemptId, questions: answers },
      }),
      "submit attempt",
    );
    return submitted.id;
  }

  return {
    student: { email: studentEmail, password: PASSWORD },
    quizTitle,
    assigningId: assigning.id,
    seedSubmittedAttempt,
  };
}
