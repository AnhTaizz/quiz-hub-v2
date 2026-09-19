import { useMemo } from "react";
import type { PracticeQuestion } from "@/types/api";
import { SaveIndicator, type SaveStatus } from "@/components/feedback/SaveIndicator";
import { Button } from "@/components/ui/Button";
import { correctTexts, evaluateAnswer, seededShuffle, type AnswerValue } from "./practiceModel";
import "./PracticeQuestionView.css";

const TYPE_LABEL: Record<string, string> = {
  SINGLE_CHOICE: "Choose one",
  MULTIPLE_CHOICE: "Choose all that apply",
  FILL_IN_BLANK: "Fill in the blank",
};

interface Props {
  question: PracticeQuestion;
  number: number;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** Instant feedback is shown and the inputs are locked once the answer was checked. */
  showAnswer: boolean;
  confirmed: boolean;
  onCheck: () => void;
  shuffleAnswers: boolean;
  saveStatus: SaveStatus;
  onRetry: () => void;
  disabled?: boolean;
}

/**
 * One practice question. All question/answer text is rendered as React text nodes (never as HTML). The
 * correct/incorrect highlighting is display-only feedback from the answer key the backend sends at start; the score
 * always comes from the backend's submit.
 */
export function PracticeQuestionView({
  question,
  number,
  value,
  onChange,
  showAnswer,
  confirmed,
  onCheck,
  shuffleAnswers,
  saveStatus,
  onRetry,
  disabled = false,
}: Props) {
  const options = useMemo(
    () => (shuffleAnswers && question.type !== "FILL_IN_BLANK" ? seededShuffle(question.answers, question.id) : question.answers),
    [question, shuffleAnswers],
  );

  const locked = disabled || (showAnswer && confirmed);
  const reveal = showAnswer && confirmed;
  const verdict = reveal ? evaluateAnswer(question, value) : null;
  const isMulti = question.type === "MULTIPLE_CHOICE";
  const needsCheckButton = showAnswer && !confirmed && question.type !== "SINGLE_CHOICE";

  function toggle(id: number) {
    if (locked) return;
    if (isMulti) {
      onChange({ ids: value.ids.includes(id) ? value.ids.filter((x) => x !== id) : [...value.ids, id], text: "" });
    } else {
      onChange({ ids: [id], text: "" });
    }
  }

  return (
    <section className="qh-practice-q" id={`practice-q-${question.id}`} aria-label={`Question ${number}`}>
      <div className="qh-practice-q__header">
        <p className="qh-practice-q__meta">
          Question {number} · {TYPE_LABEL[question.type] ?? question.type}
        </p>
        <SaveIndicator status={saveStatus} onRetry={onRetry} />
      </div>

      <p className="qh-practice-q__text">{question.text}</p>

      {question.type === "FILL_IN_BLANK" ? (
        <input
          type="text"
          className={`qh-practice-q__fill ${verdict === true ? "qh-practice-q__fill--correct" : ""} ${verdict === false ? "qh-practice-q__fill--wrong" : ""}`}
          aria-label="Your answer"
          autoComplete="off"
          value={value.text}
          readOnly={locked}
          onChange={(event) => onChange({ ids: [], text: event.target.value })}
        />
      ) : (
        <ul className="qh-practice-q__options">
          {options.map((option) => {
            const selected = value.ids.includes(option.id);
            const isCorrect = reveal && option.isCorrect === true;
            const isWrongPick = reveal && selected && option.isCorrect !== true;
            return (
              <li key={option.id}>
                <label
                  className={[
                    "qh-practice-q__option",
                    selected && "qh-practice-q__option--selected",
                    isCorrect && "qh-practice-q__option--correct",
                    isWrongPick && "qh-practice-q__option--wrong",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name={`practice-question-${question.id}`}
                    checked={selected}
                    disabled={locked}
                    onChange={() => toggle(option.id)}
                  />
                  <span>{option.text}</span>
                  {isCorrect && <span className="visually-hidden"> (correct answer)</span>}
                  {isWrongPick && <span className="visually-hidden"> (your answer, incorrect)</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {needsCheckButton && (
        <Button type="button" variant="secondary" onClick={onCheck} disabled={disabled || (value.ids.length === 0 && value.text.trim() === "")}>
          Check answer
        </Button>
      )}

      {reveal && (
        <p className={`qh-practice-q__verdict ${verdict ? "qh-practice-q__verdict--ok" : "qh-practice-q__verdict--bad"}`} role="status">
          {verdict ? "Correct" : "Incorrect"}
          {question.type === "FILL_IN_BLANK" && verdict === false && correctTexts(question).length > 0 && (
            <> - correct answer: {correctTexts(question).join(" or ")}</>
          )}
        </p>
      )}
    </section>
  );
}
