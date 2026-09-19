import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuizAttempt, type QuizSource } from "./useQuizAttempt";
import { useCountdown } from "./useCountdown";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/feedback/ToastProvider";
import { isApiError } from "@/api/httpClient";
import { SaveIndicator } from "@/components/feedback/SaveIndicator";
import { readReturnUrl } from "@/features/practice/practiceSession";
import { goToSafePath } from "@/utils/routes";
import { FullscreenGate } from "./FullscreenGate";
import { clearLocalAttempt } from "./localAttemptStorage";
import { exitFullscreenQuietly, MAX_VIOLATIONS, useQuizProctoring } from "./useQuizProctoring";
import "./QuizPlayPage.css";

export function QuizPlayByAssigningPage() {
  const { assigningId } = useParams<{ assigningId: string }>();
  return <QuizPlayPage source={{ mode: "start", assigningId: Number(assigningId) }} />;
}

export function QuizPlayByAttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  return <QuizPlayPage source={{ mode: "resume", attemptId: Number(attemptId) }} />;
}

function QuizPlayPage({ source }: { source: QuizSource }) {
  const attempt = useQuizAttempt(source);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [everLeftFullscreen, setEverLeftFullscreen] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const state = attempt.state;

  // Monitoring runs only while the attempt is really being taken; every path that ends or leaves it turns it off.
  const proctoring = useQuizProctoring({
    attemptId: state?.attemptId ?? null,
    active: !!state && !submitting && !leaving && !autoSubmitted,
    onViolation: (result, code) => {
      if (code === "FULLSCREEN_EXIT") setEverLeftFullscreen(true);
      showToast(
        `Warning ${result.violationCount} of ${MAX_VIOLATIONS}: leaving the exam is recorded. ` +
          `${Math.max(MAX_VIOLATIONS - result.violationCount, 0)} more and the quiz is submitted automatically.`,
        "warning",
      );
    },
    onAutoSubmitted: (result) => {
      // The backend already graded and ended the attempt: no second submit. Drop the local recovery data,
      // leave fullscreen (monitoring is already off) and go to the result.
      setAutoSubmitted(true);
      clearLocalAttempt(result.attemptId);
      void exitFullscreenQuietly();
      showToast(`Your quiz was submitted automatically after ${result.violationCount} violations.`, "error");
      redirectTimer.current = setTimeout(
        () => navigate(`/student/quiz/result/${result.attemptId}`, { replace: true }),
        1500,
      );
    },
  });

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  const handleSubmit = useCallback(async () => {
    // Stop monitoring synchronously so nothing (fullscreen exit, blur, unload) is logged during/after the submit.
    proctoring.stop();
    setSubmitting(true);
    try {
      const result = await attempt.submit();
      if (result) {
        await exitFullscreenQuietly();
        navigate(`/student/quiz/result/${result.id}`, { replace: true });
      }
    } catch (error) {
      showToast(isApiError(error) ? error.message : "Could not submit quiz. Your answers are saved locally - please try again.", "error");
      // Failed: the attempt is still open, so monitoring resumes (active flips back to true).
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [attempt, navigate, proctoring, showToast]);

  const handleExit = useCallback(async () => {
    // The manual exit is itself a recorded event (and counts toward the limit, like the legacy client).
    const outcome = await proctoring.logManualExit();
    proctoring.stop();
    setLeaving(true);
    if (outcome?.autoSubmitted) return; // onAutoSubmitted already routes to the result
    await exitFullscreenQuietly();
    goToSafePath(readReturnUrl(), "/student", navigate);
  }, [navigate, proctoring]);

  const countdown = useCountdown(
    state?.startedAtMillis ?? null,
    state?.durationInMins ?? 0,
    () => {
      // Backend still enforces the real deadline server-side; this only
      // triggers the client-side submit flow when the display clock hits 0.
      if (!submitting && !leaving && !autoSubmitted) void handleSubmit();
    },
  );

  if (attempt.isLoading) {
    return <Spinner label="Loading quiz" />;
  }

  if (attempt.isError || !state) {
    return <ErrorState message={attempt.errorMessage ?? "Could not load this quiz."} onRetry={() => attempt.refetch()} />;
  }

  const question = state.questions[state.currentIndex];
  if (!question) {
    return <ErrorState message="This question could not be loaded." onRetry={() => attempt.refetch()} />;
  }
  const answer = state.answers[question.id] ?? { answerIds: [], selectedText: null };
  const saveStatus = state.saveStatus[question.id] ?? "idle";
  const answeredCount = state.questions.filter((q) => {
    const a = state.answers[q.id];
    return a && (a.answerIds.length > 0 || (a.selectedText && a.selectedText.trim().length > 0));
  }).length;

  return (
    <div className="qh-quiz-play">
      {proctoring.needsFullscreen && (
        <FullscreenGate onEnter={() => void proctoring.requestFullscreen()} reEntry={everLeftFullscreen} />
      )}
      <header className="qh-quiz-play__header">
        <h1 className="qh-quiz-play__title">{state.quizTitle}</h1>
        <Button variant="ghost" type="button" onClick={() => setExitOpen(true)}>
          Exit exam
        </Button>
        <div
          className={`qh-quiz-play__timer ${countdown.isCritical ? "qh-quiz-play__timer--critical" : ""}`}
          role="timer"
          aria-live="polite"
        >
          {countdown.label}
        </div>
      </header>

      <div className="qh-quiz-play__progress" aria-label={`${answeredCount} of ${state.questions.length} answered`}>
        <div
          className="qh-quiz-play__progress-bar"
          style={{ width: `${(answeredCount / state.questions.length) * 100}%` }}
        />
      </div>

      <nav className="qh-quiz-play__nav" aria-label="Question navigator">
        {state.questions.map((q, index) => {
          const a = state.answers[q.id];
          const isAnswered = a && (a.answerIds.length > 0 || !!a.selectedText?.trim());
          return (
            <button
              key={q.id}
              type="button"
              className={[
                "qh-quiz-play__nav-dot",
                index === state.currentIndex && "qh-quiz-play__nav-dot--active",
                isAnswered && "qh-quiz-play__nav-dot--answered",
                state.flags[q.id] && "qh-quiz-play__nav-dot--flagged",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => attempt.goToQuestion(index)}
              aria-current={index === state.currentIndex ? "step" : undefined}
              aria-label={`Question ${index + 1}${isAnswered ? ", answered" : ", unanswered"}`}
            >
              {index + 1}
            </button>
          );
        })}
      </nav>

      <section className="qh-quiz-play__question" aria-label={`Question ${state.currentIndex + 1}`}>
        <div className="qh-quiz-play__question-header">
          <p className="qh-quiz-play__question-count">
            Question {state.currentIndex + 1} of {state.questions.length}
          </p>
          <SaveIndicator status={saveStatus} onRetry={() => attempt.retrySave(question.id)} />
        </div>

        {/* React text nodes only - fixes audit finding F-01. Question/answer
            text is never passed through dangerouslySetInnerHTML. */}
        <p className="qh-quiz-play__question-text">{question.text}</p>

        {question.type === "FILL_IN_BLANK" ? (
          <input
            type="text"
            className="qh-quiz-play__fill-input"
            value={answer.selectedText ?? ""}
            onChange={(e) => attempt.setFillAnswer(question.id, e.target.value)}
            aria-label="Your answer"
            autoComplete="off"
          />
        ) : (
          <ul className="qh-quiz-play__answers">
            {question.answers.map((option) => {
              const isMulti = question.type === "MULTIPLE_CHOICE";
              const isSelected = answer.answerIds.includes(option.id);
              return (
                <li key={option.id}>
                  <label
                    className={`qh-quiz-play__option ${isSelected ? "qh-quiz-play__option--selected" : ""}`}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name={`question-${question.id}`}
                      checked={isSelected}
                      onChange={() => {
                        const nextIds = isMulti
                          ? isSelected
                            ? answer.answerIds.filter((id) => id !== option.id)
                            : [...answer.answerIds, option.id]
                          : [option.id];
                        attempt.setChoiceAnswer(question.id, nextIds);
                      }}
                    />
                    <span>{option.text}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <label className="qh-quiz-play__flag">
          <input
            type="checkbox"
            checked={!!state.flags[question.id]}
            onChange={() => attempt.toggleFlag(question.id)}
          />
          Flag for review
        </label>
      </section>

      <footer className="qh-quiz-play__footer">
        <Button
          variant="secondary"
          onClick={() => attempt.goToQuestion(Math.max(0, state.currentIndex - 1))}
          disabled={state.currentIndex === 0}
        >
          Previous
        </Button>
        {state.currentIndex < state.questions.length - 1 ? (
          <Button onClick={() => attempt.goToQuestion(state.currentIndex + 1)}>Next</Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)}>Submit quiz</Button>
        )}
      </footer>

      <Modal
        isOpen={confirmOpen}
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
        title="Submit quiz?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              Submit
            </Button>
          </>
        }
      >
        <p>
          You have answered {answeredCount} of {state.questions.length} questions. Once submitted, you cannot
          change your answers.
        </p>
      </Modal>

      <Modal
        isOpen={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave the exam?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExitOpen(false)}>
              Keep working
            </Button>
            <Button variant="danger" onClick={() => void handleExit()}>
              Leave now
            </Button>
          </>
        }
      >
        <p>
          Leaving is recorded as an early exit and counts toward the {MAX_VIOLATIONS}-violation limit. Your saved
          answers are kept, and you can resume this quiz if time remains.
        </p>
      </Modal>
    </div>
  );
}
