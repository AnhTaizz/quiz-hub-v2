import type { AssignedQuizSummary } from "@/types/api";

export type QuizAvailability = "not_started" | "available" | "expired";

/**
 * Mirrors the availability check the legacy Thymeleaf templates perform
 * inline (e.g. student-classroom-detail.html's `now.isBefore(startDate)` /
 * `now.isAfter(dueDate)`). This is a client-side *display* hint only - the
 * backend independently enforces QUIZ_NOT_STARTED/QUIZ_EXPIRED at attempt
 * start/submit time, so a clock skew here never grants access the server
 * would reject.
 */
export function getQuizAvailability(quiz: AssignedQuizSummary, now: Date = new Date()): QuizAvailability {
  if (quiz.startDate && now < new Date(quiz.startDate)) return "not_started";
  if (quiz.dueDate && now > new Date(quiz.dueDate)) return "expired";
  return "available";
}

export function formatAttemptsLeft(quiz: AssignedQuizSummary): string {
  if (quiz.attemptsLeft < 0) return "Unlimited attempts";
  return `${quiz.attemptsLeft} attempt${quiz.attemptsLeft === 1 ? "" : "s"} left`;
}
