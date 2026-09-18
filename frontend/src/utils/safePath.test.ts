import { describe, expect, it } from "vitest";
import { isSafeInternalPath, resolveSafeReturnPath } from "./safePath";

describe("isSafeInternalPath", () => {
  it.each([
    "/student",
    "/student/quizzes",
    "/student/classrooms/42",
    "/student/quiz/play/7?foo=bar",
    "/",
  ])("accepts safe relative path %s", (path) => {
    expect(isSafeInternalPath(path)).toBe(true);
  });

  it.each([
    ["external absolute URL", "https://evil.example"],
    ["protocol-relative URL", "//evil.example"],
    ["protocol-relative with backslash", "/\\evil.example"],
    ["javascript URL", "javascript:alert(1)"],
    ["javascript URL disguised with slash", "javascript:/alert(1)"],
    ["data URL", "data:text/html,<script>alert(1)</script>"],
    ["missing leading slash", "student/quizzes"],
    ["empty string", ""],
    ["null", null],
    ["undefined", undefined],
  ])("rejects %s (%s)", (_label, value) => {
    expect(isSafeInternalPath(value)).toBe(false);
  });
});

describe("resolveSafeReturnPath", () => {
  it("returns the value when safe", () => {
    expect(resolveSafeReturnPath("/student/history", "/student")).toBe("/student/history");
  });

  it("falls back to the role dashboard when unsafe", () => {
    expect(resolveSafeReturnPath("https://evil.example", "/student")).toBe("/student");
  });

  it("falls back when missing", () => {
    expect(resolveSafeReturnPath(null, "/student")).toBe("/student");
    expect(resolveSafeReturnPath(undefined, "/student")).toBe("/student");
  });
});
