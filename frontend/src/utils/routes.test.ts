import { describe, expect, it, vi } from "vitest";
import { goToSafePath, isReactRoute } from "./routes";

describe("isReactRoute", () => {
  it.each([
    "/",
    "/login",
    "/profile",
    "/oauth2-choose-role.html",
    "/student",
    "/student/practice",
    "/student/practice/play",
    "/student/practice/review/42",
    "/student/classrooms/7",
    "/student/quiz/result/3?x=1",
  ])("treats %s as React-owned", (path) => expect(isReactRoute(path)).toBe(true));

  it.each([
    "/teacher",
    "/teacher/classrooms/5/members",
    "/admin/moderation",
    "/student/categories",
    "/student/questions",
    "/student/quiz/create",
    "/student/practice/review/abc",
    "/student/classrooms/abc",
  ])("treats %s as still server-rendered", (path) => expect(isReactRoute(path)).toBe(false));
});

describe("goToSafePath", () => {
  it("uses the router for React-owned routes", () => {
    const navigate = vi.fn();
    const assign = vi.fn();
    goToSafePath("/student/history", "/student", navigate, assign);
    expect(navigate).toHaveBeenCalledWith("/student/history", { replace: true });
    expect(assign).not.toHaveBeenCalled();
  });

  it("uses a full page load for legacy routes (teacher/admin must not hit a blank router)", () => {
    const navigate = vi.fn();
    const assign = vi.fn();
    goToSafePath("/teacher", "/student", navigate, assign);
    expect(assign).toHaveBeenCalledWith("/teacher");
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(["https://evil.example", "//evil.example", "javascript:alert(1)", "data:text/html,x", null, undefined])(
    "falls back for unsafe target %s",
    (target) => {
      const navigate = vi.fn();
      const assign = vi.fn();
      goToSafePath(target, "/student", navigate, assign);
      expect(navigate).toHaveBeenCalledWith("/student", { replace: true });
      expect(assign).not.toHaveBeenCalled();
    },
  );
});
