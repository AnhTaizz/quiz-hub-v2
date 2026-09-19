import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { isApiError } from "@/api/httpClient";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { goToSafePath } from "@/utils/routes";
import { EMPTY_ANSWER, isAnswered } from "./practiceModel";
import { loadPracticeSession, readReturnUrl, type PracticeSession } from "./practiceSession";
import { usePracticePlayer } from "./usePracticePlayer";
import { PracticeFlashcard } from "./PracticeFlashcard";
import { PracticeQuestionView } from "./PracticeQuestionView";
import "./PracticePlayPage.css";

// A stateless personal-quiz practice (no practiceId; graded in the browser, nothing saved) is part of the question
// library that has not been migrated. The legacy player keeps serving it from this server route, reading the very
// same sessionStorage keys.
const LEGACY_PERSONAL_PLAY = "/student/practice/personal-play";

export function PracticePlayPage() {
  // Read once: loading applies the one-time "shuffle questions" step and must not change under the player.
  const session = useMemo(() => loadPracticeSession(), []);

  if (!session) {
    return (
      <div className="qh-practice-play">
        <EmptyState
          title="No practice in progress"
          description="Choose a category and settings to start a new practice session."
          action={
            <Link to="/student/practice" className="qh-button qh-button--primary">
              Set up a practice
            </Link>
          }
        />
      </div>
    );
  }

  if (session.practiceId === null) return <HandOffToLegacyPlayer />;
  return <PracticePlayer session={session} />;
}

function HandOffToLegacyPlayer() {
  useEffect(() => {
    window.location.replace(LEGACY_PERSONAL_PLAY);
  }, []);
  return <Spinner label="Opening your practice" />;
}

function PracticePlayer({ session }: { session: PracticeSession }) {
  const player = usePracticePlayer(session);
  const { state } = player;
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { displayMode, showAnswer, shuffleAnswers } = session.settings;
  const total = session.questions.length;
  const current = session.questions[state.index];
  const isFlashcard = displayMode === "flashcard";

  // Arrow keys move between cards/questions (legacy parity) - never while typing in a field.
  useEffect(() => {
    if (displayMode === "all") return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (event.key === "ArrowRight") player.goTo(Math.min(state.index + 1, total - 1));
      if (event.key === "ArrowLeft") player.goTo(Math.max(state.index - 1, 0));
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [displayMode, player, state.index, total]);

  function exit() {
    goToSafePath(readReturnUrl(), "/student/practice", navigate);
  }

  async function doSubmit() {
    setSubmitting(true);
    try {
      const result = await player.submit();
      if (result) navigate(`/student/practice/review/${result.practiceId ?? session.practiceId}`, { replace: true });
    } catch (error) {
      showToast(
        isApiError(error) ? error.message : "Could not submit your practice. Your answers are kept - please try again.",
        "error",
      );
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  function renderQuestion(index: number) {
    const question = session.questions[index];
    if (!question) return null;
    const value = state.answers[question.id] ?? EMPTY_ANSWER;
    return (
      <PracticeQuestionView
        key={question.id}
        question={question}
        number={index + 1}
        value={value}
        onChange={(next) => player.setAnswer(question, next)}
        showAnswer={showAnswer}
        confirmed={!!state.confirmed[question.id]}
        onCheck={() => player.confirmAnswer(question.id)}
        shuffleAnswers={shuffleAnswers}
        saveStatus={state.saveStatus[question.id] ?? "idle"}
        onRetry={() => player.retrySave(question)}
      />
    );
  }

  const unanswered = total - player.answeredCount;

  return (
    <div className="qh-practice-play">
      <header className="qh-practice-play__header">
        <div className="qh-practice-play__heading">
          <h1 className="qh-practice-play__title">{session.categoryName || "Practice"}</h1>
          <p className="qh-practice-play__progress">
            {isFlashcard ? `Card ${state.index + 1} of ${total}` : `${player.answeredCount} of ${total} answered`}
          </p>
        </div>
        <Button variant="secondary" type="button" onClick={exit}>
          Exit
        </Button>
      </header>

      {state.alreadySubmitted && (
        <p className="qh-practice-play__alert" role="alert">
          This practice was already submitted, so new answers cannot be saved.{" "}
          <Link to={`/student/practice/review/${session.practiceId}`}>Open the review</Link>
        </p>
      )}

      <nav className="qh-practice-play__nav" aria-label="Question navigator">
        {session.questions.map((question, index) => {
          const answered = isAnswered(state.answers[question.id]);
          return (
            <button
              key={question.id}
              type="button"
              className={[
                "qh-practice-play__dot",
                displayMode !== "all" && index === state.index && "qh-practice-play__dot--active",
                answered && !isFlashcard && "qh-practice-play__dot--answered",
                state.flagged[question.id] && "qh-practice-play__dot--flagged",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={displayMode !== "all" && index === state.index ? "step" : undefined}
              aria-label={`Question ${index + 1}${isFlashcard ? "" : answered ? ", answered" : ", unanswered"}`}
              onClick={() => {
                if (displayMode === "all") document.getElementById(`practice-q-${question.id}`)?.scrollIntoView({ block: "start" });
                else player.goTo(index);
              }}
            >
              {index + 1}
            </button>
          );
        })}
      </nav>

      {displayMode === "all" && <div className="qh-practice-play__list">{session.questions.map((_, index) => renderQuestion(index))}</div>}

      {displayMode === "sequential" && current && renderQuestion(state.index)}

      {isFlashcard && current && <PracticeFlashcard key={current.id} question={current} number={state.index + 1} />}

      {current && displayMode !== "all" && (
        <label className="qh-practice-play__flag">
          <input type="checkbox" checked={!!state.flagged[current.id]} onChange={() => player.toggleFlag(current.id)} />
          Flag for review
        </label>
      )}

      <footer className="qh-practice-play__footer">
        {displayMode !== "all" && (
          <Button variant="secondary" onClick={() => player.goTo(Math.max(0, state.index - 1))} disabled={state.index === 0}>
            Previous
          </Button>
        )}
        {displayMode !== "all" && state.index < total - 1 ? (
          <Button onClick={() => player.goTo(state.index + 1)}>Next</Button>
        ) : isFlashcard ? (
          <Button onClick={exit}>Finish studying</Button>
        ) : (
          <Button onClick={() => setConfirmOpen(true)}>Submit practice</Button>
        )}
      </footer>

      <Modal
        isOpen={confirmOpen}
        onClose={() => (submitting ? undefined : setConfirmOpen(false))}
        title="Submit practice?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button onClick={() => void doSubmit()} isLoading={submitting}>
              Submit
            </Button>
          </>
        }
      >
        <p>
          You have answered {player.answeredCount} of {total} questions.
          {unanswered > 0 && ` ${unanswered} unanswered question${unanswered === 1 ? "" : "s"} will count as incorrect.`}
        </p>
      </Modal>
    </div>
  );
}
