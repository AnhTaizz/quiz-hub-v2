import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quizApi } from "@/api/quiz.api";
import type { ViolationResponse } from "@/types/api";
import { BLUR_AFTER_TAB_SWITCH_MS, useQuizProctoring } from "./useQuizProctoring";

vi.mock("@/api/quiz.api", () => ({
  quizApi: { logViolation: vi.fn() },
}));

const logViolation = vi.mocked(quizApi.logViolation);

let fullscreenElement: Element | null = null;
let visibility: DocumentVisibilityState = "visible";

function fire(target: Document | Window, type: string) {
  act(() => {
    target.dispatchEvent(new Event(type));
  });
}
const hideTab = () => {
  visibility = "hidden";
  fire(document, "visibilitychange");
};
const setFullscreen = (element: Element | null) => {
  fullscreenElement = element;
  fire(document, "fullscreenchange");
};

function result(count: number, autoSubmitted = false): ViolationResponse {
  return { violationCount: count, autoSubmitted, attemptId: 7 };
}

function setup(overrides: Partial<Parameters<typeof useQuizProctoring>[0]> = {}) {
  const onViolation = vi.fn();
  const onAutoSubmitted = vi.fn();
  const hook = renderHook((props: Parameters<typeof useQuizProctoring>[0]) => useQuizProctoring(props), {
    initialProps: { attemptId: 7, active: true, onViolation, onAutoSubmitted, ...overrides },
  });
  return { ...hook, onViolation, onAutoSubmitted };
}

beforeEach(() => {
  vi.clearAllMocks();
  fullscreenElement = null;
  visibility = "visible";
  logViolation.mockResolvedValue(result(1));
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
  Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
});

afterEach(() => vi.useRealTimers());

describe("useQuizProctoring - what is reported", () => {
  it("reports TAB_SWITCH when the tab becomes hidden (and only then)", async () => {
    setup();
    fire(document, "visibilitychange"); // still visible: ignored
    expect(logViolation).not.toHaveBeenCalled();

    hideTab();
    await waitFor(() => expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "TAB_SWITCH" }));
    expect(logViolation).toHaveBeenCalledTimes(1);
  });

  it("reports WINDOW_BLUR", async () => {
    setup();
    fire(window, "blur");
    await waitFor(() => expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "WINDOW_BLUR" }));
  });

  it("counts one physical tab switch once: the blur that follows it is the same event", async () => {
    setup();
    hideTab();
    fire(window, "blur");
    await waitFor(() => expect(logViolation).toHaveBeenCalledTimes(1));
    expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "TAB_SWITCH" });
  });

  it("still reports a later, separate blur", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    setup();
    hideTab();
    vi.setSystemTime(new Date(Date.now() + BLUR_AFTER_TAB_SWITCH_MS + 1));
    fire(window, "blur");
    await vi.waitFor(() => expect(logViolation).toHaveBeenCalledTimes(2));
    expect(logViolation).toHaveBeenLastCalledWith({ attemptId: 7, violationCode: "WINDOW_BLUR" });
  });

  it("reports FULLSCREEN_EXIT only on exit - entering fullscreen is never a violation", async () => {
    setup();
    setFullscreen(document.documentElement);
    expect(logViolation).not.toHaveBeenCalled();

    setFullscreen(null);
    await waitFor(() => expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "FULLSCREEN_EXIT" }));
  });

  it("logs TAB_CLOSE on unload with keepalive (an Authorization-bearing request, not sendBeacon)", () => {
    setup();
    fire(window, "beforeunload");
    expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "TAB_CLOSE" }, { keepalive: true });
  });

  it("passes the backend answer to onViolation", async () => {
    logViolation.mockResolvedValue(result(2));
    const { onViolation } = setup();
    hideTab();
    await waitFor(() => expect(onViolation).toHaveBeenCalledWith(result(2), "TAB_SWITCH"));
  });
});

describe("useQuizProctoring - lifecycle", () => {
  it("logs nothing while inactive (loading, submitting, leaving) or without an attempt", () => {
    setup({ active: false });
    setup({ attemptId: null });
    hideTab();
    fire(window, "blur");
    fire(window, "beforeunload");
    setFullscreen(null);
    expect(logViolation).not.toHaveBeenCalled();
  });

  it("removes its listeners on unmount (no violations after leaving the quiz)", () => {
    const { unmount } = setup();
    unmount();
    hideTab();
    fire(window, "blur");
    fire(window, "beforeunload");
    setFullscreen(null);
    expect(logViolation).not.toHaveBeenCalled();
  });

  it("stops listening as soon as active flips to false (e.g. submit in flight)", () => {
    const { rerender, onViolation, onAutoSubmitted } = setup();
    rerender({ attemptId: 7, active: false, onViolation, onAutoSubmitted });
    hideTab();
    fire(window, "blur");
    expect(logViolation).not.toHaveBeenCalled();
  });

  it("stop() disables monitoring synchronously, before any re-render", () => {
    const { result: hook } = setup();
    act(() => hook.current.stop());
    hideTab();
    fire(window, "beforeunload");
    expect(logViolation).not.toHaveBeenCalled();
  });

  it("does not log on ordinary re-renders", () => {
    const { rerender, onViolation, onAutoSubmitted } = setup();
    for (let i = 0; i < 5; i++) rerender({ attemptId: 7, active: true, onViolation, onAutoSubmitted });
    expect(logViolation).not.toHaveBeenCalled();
  });

  it("re-enables monitoring when active returns (a failed submit does not leave the exam unmonitored)", async () => {
    const { rerender, onViolation, onAutoSubmitted } = setup();
    rerender({ attemptId: 7, active: false, onViolation, onAutoSubmitted });
    rerender({ attemptId: 7, active: true, onViolation, onAutoSubmitted });
    hideTab();
    await waitFor(() => expect(logViolation).toHaveBeenCalledTimes(1));
  });

  it("uses the latest callbacks, not the ones from the first render (no stale closures)", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, onAutoSubmitted } = setup({ onViolation: first });
    rerender({ attemptId: 7, active: true, onViolation: second, onAutoSubmitted });
    hideTab();
    await waitFor(() => expect(second).toHaveBeenCalled());
    expect(first).not.toHaveBeenCalled();
  });
});

describe("useQuizProctoring - auto-submit", () => {
  it("calls onAutoSubmitted once and reports nothing further", async () => {
    logViolation.mockResolvedValue(result(3, true));
    const { onViolation, onAutoSubmitted } = setup();
    hideTab();
    await waitFor(() => expect(onAutoSubmitted).toHaveBeenCalledWith(result(3, true)));
    expect(onViolation).not.toHaveBeenCalled();

    fire(window, "blur");
    fire(window, "beforeunload");
    setFullscreen(null);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(logViolation).toHaveBeenCalledTimes(1);
    expect(onAutoSubmitted).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed report (the exam must not break)", async () => {
    logViolation.mockRejectedValue({ status: 500, message: "boom" });
    const { onViolation } = setup();
    hideTab();
    await waitFor(() => expect(logViolation).toHaveBeenCalled());
    expect(onViolation).not.toHaveBeenCalled();
  });
});

describe("useQuizProctoring - manual exit", () => {
  it("logs MANUAL_EXIT even though monitoring is stopping, and returns the backend answer", async () => {
    logViolation.mockResolvedValue(result(3, true));
    const { result: hook, onAutoSubmitted } = setup({ active: false });
    let answer: ViolationResponse | null = null;
    await act(async () => {
      answer = await hook.current.logManualExit();
    });
    expect(logViolation).toHaveBeenCalledWith({ attemptId: 7, violationCode: "MANUAL_EXIT" });
    expect(answer).toEqual(result(3, true));
    expect(onAutoSubmitted).toHaveBeenCalled();
  });
});

describe("useQuizProctoring - fullscreen gate", () => {
  it("blocks until fullscreen while monitoring", () => {
    const { result: hook } = setup();
    expect(hook.current.needsFullscreen).toBe(true);
  });

  it("does not block when inactive, or when the browser cannot do fullscreen", () => {
    expect(setup({ active: false }).result.current.needsFullscreen).toBe(false);
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    expect(setup().result.current.needsFullscreen).toBe(false);
  });

  it("opens the gate again after a fullscreen exit, and closes it on re-entry", async () => {
    const { result: hook } = setup();
    setFullscreen(document.documentElement);
    expect(hook.current.needsFullscreen).toBe(false);
    setFullscreen(null);
    expect(hook.current.needsFullscreen).toBe(true);
    await waitFor(() => expect(logViolation).toHaveBeenCalledTimes(1));
  });

  it("stops blocking if the browser refuses the fullscreen request", async () => {
    document.documentElement.requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    const { result: hook } = setup();
    await act(async () => {
      await hook.current.requestFullscreen();
    });
    expect(hook.current.fullscreenFailed).toBe(true);
    expect(hook.current.needsFullscreen).toBe(false);
  });
});
