import type { AssignedQuizSummary } from "@/types/api";

export type QuizAvailability = "not_started" | "available" | "expired";

/**
 * Availability is decided by the server (`AssignedQuizSummaryDTO.availability`), never re-derived
 * here. The backend pins its JVM to Asia/Ho_Chi_Minh and serializes dates as offset-less
 * LocalDateTime strings, so comparing them with the browser's clock is wrong for any user outside
 * that zone (this is exactly what broke the CI E2E run, which is in UTC). The backend also
 * independently enforces QUIZ_NOT_STARTED / QUIZ_EXPIRED when a quiz is actually started.
 */
export function getQuizAvailability(quiz: AssignedQuizSummary): QuizAvailability {
  switch (quiz.availability) {
    case "NOT_STARTED":
      return "not_started";
    case "EXPIRED":
      return "expired";
    case "AVAILABLE":
      return "available";
  }
}

export function formatAttemptsLeft(quiz: AssignedQuizSummary): string {
  if (quiz.attemptsLeft < 0) return "Unlimited attempts";
  return `${quiz.attemptsLeft} attempt${quiz.attemptsLeft === 1 ? "" : "s"} left`;
}
