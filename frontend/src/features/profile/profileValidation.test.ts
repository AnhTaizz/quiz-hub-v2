import { describe, expect, it } from "vitest";
import {
  initials,
  mapPasswordApiError,
  validateAvatarFile,
  validatePasswordChange,
  validateProfile,
} from "./profileValidation";

describe("validateAvatarFile", () => {
  it("accepts an image within the limit", () => {
    expect(validateAvatarFile({ type: "image/png", size: 1024 })).toBeNull();
  });
  it("rejects non-images", () => {
    expect(validateAvatarFile({ type: "text/html", size: 10 })).toMatch(/image file/i);
  });
  it("rejects files over 5 MB", () => {
    expect(validateAvatarFile({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});

describe("validateProfile", () => {
  it("requires a non-blank full name", () => {
    expect(validateProfile({ fullName: "   " }).fullName).toBeDefined();
    expect(validateProfile({ fullName: "Ada Lovelace" })).toEqual({});
  });
});

describe("validatePasswordChange", () => {
  const ok = { oldPassword: "old-secret", newPassword: "new-secret", confirmNewPassword: "new-secret" };

  it("accepts a valid change", () => expect(validatePasswordChange(ok)).toEqual({}));
  it("requires the current password", () =>
    expect(validatePasswordChange({ ...ok, oldPassword: "" }).oldPassword).toBeDefined());
  it("enforces the 6 character minimum", () =>
    expect(validatePasswordChange({ ...ok, newPassword: "abc", confirmNewPassword: "abc" }).newPassword).toMatch(/6/));
  it("rejects reusing the current password", () =>
    expect(
      validatePasswordChange({ oldPassword: "same-pass", newPassword: "same-pass", confirmNewPassword: "same-pass" })
        .newPassword,
    ).toBeDefined());
  it("requires the confirmation to match", () =>
    expect(validatePasswordChange({ ...ok, confirmNewPassword: "different" }).confirmNewPassword).toBeDefined());
});

describe("mapPasswordApiError (keyed on the backend error code)", () => {
  it.each([
    [1011, "oldPassword"],
    [1022, "newPassword"],
    [1010, "confirmNewPassword"],
    [9999, "general"],
    [undefined, "general"],
  ])("code %s -> %s", (code, field) => {
    expect(mapPasswordApiError({ code, message: "m" }).field).toBe(field);
  });
});

describe("initials", () => {
  it.each([
    ["Ada Lovelace", "AL"],
    ["  single  ", "S"],
    ["", "?"],
  ])("%j -> %s", (name, expected) => expect(initials(name)).toBe(expected));
});
