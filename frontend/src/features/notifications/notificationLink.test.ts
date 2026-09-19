import { describe, expect, it } from "vitest";
import { resolveNotificationTarget } from "./notificationLink";

describe("resolveNotificationTarget", () => {
  it.each(["/student/classrooms", "/student/classrooms/5", "/student/history", "/profile"])(
    "routes React-owned %s through the client router",
    (link) => expect(resolveNotificationTarget(link)).toEqual({ kind: "react", path: link }),
  );

  it.each(["/teacher/classrooms/5/members", "/admin/moderation", "/teacher/questions", "/student/categories"])(
    "uses a full page load for server-rendered %s",
    (link) => expect(resolveNotificationTarget(link)).toEqual({ kind: "server", path: link }),
  );

  it.each([
    "https://evil.example/phish",
    "//evil.example",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "/\\evil.example",
    "student/history",
    "",
    null,
    undefined,
  ])("never follows an unsafe link (%s)", (link) => {
    expect(resolveNotificationTarget(link)).toEqual({ kind: "none" });
  });
});
