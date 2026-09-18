import { useEffect, useRef, useState } from "react";

/**
 * Derives remaining time from the server's recorded attempt start time
 * (`startedAtMillis`) plus its duration, not from when the component
 * happened to mount - so a page reload mid-quiz shows the correct remaining
 * time rather than restarting the clock. This is a *display* countdown
 * only: the backend independently enforces the real deadline when
 * save-answer/submit requests arrive, so a fast/slow client clock can never
 * grant extra time.
 *
 * Pass `null` until the attempt has loaded; the countdown is then inert.
 */
export function useCountdown(startedAtMillis: number | null, durationInMins: number, onExpire: () => void) {
  const endAtMillis = startedAtMillis === null ? null : startedAtMillis + durationInMins * 60_000;
  const [remainingMs, setRemainingMs] = useState(() =>
    endAtMillis === null ? 0 : Math.max(0, endAtMillis - Date.now()),
  );
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (endAtMillis === null) return;
    const tick = () => {
      const next = Math.max(0, endAtMillis - Date.now());
      setRemainingMs(next);
      if (next <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endAtMillis]);

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    remainingMs,
    label: `${minutes}:${seconds.toString().padStart(2, "0")}`,
    isCritical: remainingMs > 0 && remainingMs <= 60_000,
  };
}
