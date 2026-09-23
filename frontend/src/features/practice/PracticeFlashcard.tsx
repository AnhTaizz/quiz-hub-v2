import { useState } from "react";
import type { PracticeQuestion } from "@/types/api";
import { Button } from "@/components/ui/Button";
import { correctTexts } from "./practiceModel";
import "./PracticeFlashcard.css";

/**
 * Study-only card: the question on the front, the answer key on the back. Nothing is saved or scored (same as the
 * legacy flashcard mode). Keyed by question id by the caller so each card starts on its front.
 */
export function PracticeFlashcard({ question, number, onFlip }: { question: PracticeQuestion; number: number; onFlip?: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const answers = correctTexts(question);

  return (
    <section className="qh-flashcard" aria-label={`Flashcard ${number}`}>
      <p className="qh-flashcard__label">{flipped ? "Đáp án" : `Câu ${number}`}</p>
      {flipped ? (
        answers.length > 0 ? (
          <ul className="qh-flashcard__answers">
            {answers.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
        ) : (
          <p className="qh-flashcard__text">No answer key is available for this card.</p>
        )
      ) : (
        <p className="qh-flashcard__text">{question.text}</p>
      )}
      <Button
        type="button"
        variant="secondary"
        aria-pressed={flipped}
        onClick={() => {
          setFlipped((value) => !value);
          onFlip?.();
        }}
      >
        {flipped ? "Show question" : "Show answer"}
      </Button>
    </section>
  );
}
