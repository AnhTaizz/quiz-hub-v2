import { describe, expect, it } from "vitest";
import { decodeBase64Name, parseChooseRoleParams } from "./oauthParams";

function b64(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

describe("decodeBase64Name", () => {
  it("decodes UTF-8 (Vietnamese) names", () => {
    expect(decodeBase64Name(b64("Nguyễn Văn Á"))).toBe("Nguyễn Văn Á");
  });

  it("restores a '+' that URLSearchParams turned into a space", () => {
    // Find a name whose base64 contains '+', then simulate the query-string round trip.
    const name = "???>>>~~~";
    const encoded = b64(name);
    expect(encoded).toContain("+");
    const params = new URLSearchParams(`fullName=${encoded}`);
    expect(params.get("fullName")).toContain(" ");
    expect(decodeBase64Name(params.get("fullName") ?? "")).toBe(name);
  });

  it("accepts URL-safe base64", () => {
    const name = "???>>>~~~";
    const urlSafe = b64(name).replace(/\+/g, "-").replace(/\//g, "_");
    expect(decodeBase64Name(urlSafe)).toBe(name);
  });

  it("falls back to the raw value when it is not valid base64/UTF-8", () => {
    expect(decodeBase64Name("not base64 at all!!")).toBe("not base64 at all!!");
  });
});

describe("parseChooseRoleParams", () => {
  it("parses a well-formed handoff", () => {
    const params = new URLSearchParams({
      email: "ada@example.com",
      fullName: b64("Ada Lovelace"),
      avatarUrl: "https://lh3.googleusercontent.com/a/photo",
    });
    expect(parseChooseRoleParams(params)).toEqual({
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo",
    });
  });

  it.each([
    ["missing email", ""],
    ["blank email", "email=%20"],
    ["not an email", "email=nope"],
  ])("returns null for %s", (_label, query) => {
    expect(parseChooseRoleParams(new URLSearchParams(query))).toBeNull();
  });

  it("falls back to the email when the name is missing", () => {
    expect(parseChooseRoleParams(new URLSearchParams({ email: "a@b.co" }))?.fullName).toBe("a@b.co");
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "http://insecure.example/x.png", "//evil.example/x.png"])(
    "drops a non-https avatar URL (%s)",
    (avatarUrl) => {
      const parsed = parseChooseRoleParams(new URLSearchParams({ email: "a@b.co", avatarUrl }));
      expect(parsed?.avatarUrl).toBe("");
    },
  );

  it("keeps hostile text inert (it is data, rendered as text elsewhere)", () => {
    const parsed = parseChooseRoleParams(
      new URLSearchParams({ email: "a@b.co", fullName: b64("<img src=x onerror=alert(1)>") }),
    );
    expect(parsed?.fullName).toBe("<img src=x onerror=alert(1)>");
  });
});
