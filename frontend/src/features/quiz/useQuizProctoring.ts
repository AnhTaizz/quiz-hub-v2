import { useCallback, useEffect, useRef, useState } from "react";
import { quizApi } from "@/api/quiz.api";
import type { ViolationResponse } from "@/types/api";

/**
 * Exam proctoring for the quiz player - parity with the legacy quiz-play.js, using the same endpoint and the
 * same violation codes the teacher monitoring pages understand:
 *
 *   TAB_SWITCH       document becomes hidden
 *   WINDOW_BLUR      the window loses focus
 *   FULLSCREEN_EXIT  fullscreen is exited (never logged for merely not being fullscreen yet)
 *   TAB_CLOSE        the page is unloading
 *   MANUAL_EXIT      the student confirms leaving the exam
 *
 * The backend counts every code equally, auto-submits the attempt at 3 and is idempotent once it has ended;
 * grading and the threshold live there. This hook only reports events and reacts to the answer.
 */
export type ViolationCode = "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "TAB_CLOSE" | "MANUAL_EXIT";

/** Mirrors the backend's hard-coded threshold; used only to word the warning ("N of 3"). */
export const MAX_VIOLATIONS = 3;

/**
 * One physical "switch to another tab" fires visibilitychange AND blur. The legacy client counted that as two
 * strikes; a blur right after a tab switch is treated as the same event.
 */
export const BLUR_AFTER_TAB_SWITCH_MS = 1000;

interface Options {
  attemptId: number | null;
  /** True only while the attempt is really being taken: loaded, not submitting/leaving, not auto-submitted. */
  active: boolean;
  onViolation: (result: ViolationResponse, code: ViolationCode) => void;
  onAutoSubmitted: (result: ViolationResponse) => void;
}

export async function exitFullscreenQuietly(): Promise<void> {
  if (typeof document === "undefined" || !document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {
    // Nothing to do: leaving fullscreen is best-effort.
  }
}

export function useQuizProctoring({ attemptId, active, onViolation, onAutoSubmitted }: Options) {
  const monitoring = active && attemptId !== null;

  // Event handlers read refs, never stale render closures.
  const monitoringRef = useRef(false);
  const attemptRef = useRef<number | null>(attemptId);
  const handlersRef = useRef({ onViolation, onAutoSubmitted });
  const lastTabSwitchAt = useRef(0);

  useEffect(() => {
    attemptRef.current = attemptId;
    handlersRef.current = { onViolation, onAutoSubmitted };
  });
  useEffect(() => {
    monitoringRef.current = monitoring;
  }, [monitoring]);

  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  const [fullscreenFailed, setFullscreenFailed] = useState(false);
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled === true;

  const report = useCallback(async (code: ViolationCode, force = false): Promise<ViolationResponse | null> => {
    const id = attemptRef.current;
    if (id === null || (!force && !monitoringRef.current)) return null;
    try {
      const result = await quizApi.logViolation({ attemptId: id, violationCode: code });
      if (result.autoSubmitted) {
        monitoringRef.current = false; // the attempt is over: nothing more may be logged
        handlersRef.current.onAutoSubmitted(result);
      } else if (monitoringRef.current || force) {
        handlersRef.current.onViolation(result, code);
      }
      return result;
    } catch {
      // A failed report must never break the exam; the backend still enforces its own rules.
      return null;
    }
  }, []);

  // Fullscreen state is tracked always (the gate needs it); a violation is logged only while monitoring, and only on EXIT.
  useEffect(() => {
    function onFullscreenChange() {
      const fullscreen = !!document.fullscreenElement;
      setIsFullscreen(fullscreen);
      if (!fullscreen) void report("FULLSCREEN_EXIT");
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [report]);

  // The remaining listeners exist only while the attempt is being taken, and are removed on unmount / submit / leave.
  useEffect(() => {
    if (!monitoring) return;

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        lastTabSwitchAt.current = Date.now();
        void report("TAB_SWITCH");
      }
    }
    function onBlur() {
      if (Date.now() - lastTabSwitchAt.current < BLUR_AFTER_TAB_SWITCH_MS) return;
      void report("WINDOW_BLUR");
    }
    function onBeforeUnload() {
      const id = attemptRef.current;
      if (!monitoringRef.current || id === null) return;
      // Nothing can be awaited while unloading. keepalive lets the request outlive the page, and unlike
      // navigator.sendBeacon it can carry the Authorization header, so authentication is not weakened.
      void quizApi.logViolation({ attemptId: id, violationCode: "TAB_CLOSE" }, { keepalive: true }).catch(() => undefined);
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [monitoring, report]);

  /** Synchronously turn monitoring off (before a submit / navigation), without waiting for a re-render. */
  const stop = useCallback(() => {
    monitoringRef.current = false;
  }, []);

  const requestFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreenFailed(false);
    } catch {
      // Denied/unsupported: do not trap the student behind a gate they cannot pass.
      setFullscreenFailed(true);
    }
  }, []);

  return {
    /** The blocking gate is shown when true. */
    needsFullscreen: monitoring && fullscreenSupported && !isFullscreen && !fullscreenFailed,
    fullscreenFailed,
    requestFullscreen,
    stop,
    /** Logs regardless of the monitoring flag (used for the deliberate manual exit). */
    logManualExit: () => report("MANUAL_EXIT", true),
  };
}
