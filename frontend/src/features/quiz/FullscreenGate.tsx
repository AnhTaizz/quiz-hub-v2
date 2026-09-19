import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import "./FullscreenGate.css";

/**
 * Blocking overlay shown until the exam is in fullscreen. Browsers only allow entering fullscreen from a user
 * gesture, so the student has to press the button; the initial "not fullscreen yet" state is NOT a violation.
 */
export function FullscreenGate({ onEnter, reEntry }: { onEnter: () => void; reEntry: boolean }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div className="qh-fs-gate" role="alertdialog" aria-modal="true" aria-labelledby="qh-fs-title" aria-describedby="qh-fs-desc">
      <div className="qh-fs-gate__card">
        <h2 id="qh-fs-title" className="qh-fs-gate__title">
          {reEntry ? "Return to fullscreen" : "Fullscreen required"}
        </h2>
        <p id="qh-fs-desc" className="qh-fs-gate__text">
          {reEntry
            ? "You left fullscreen. This was recorded. Return to fullscreen to continue your quiz."
            : "For a fair exam this quiz runs in fullscreen. Leaving fullscreen, switching tabs or leaving the window is recorded, and after 3 such events the quiz is submitted automatically."}
        </p>
        <Button ref={buttonRef} type="button" onClick={onEnter}>
          Enter fullscreen
        </Button>
      </div>
    </div>
  );
}
