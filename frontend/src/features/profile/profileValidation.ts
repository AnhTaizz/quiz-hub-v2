// Client-side checks are only a UX convenience: the backend stays the authority (image content type, 5 MB
// limit, password rules) and every rejection it sends is displayed.

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MIN_PASSWORD_LENGTH = 6;

export interface FileLike {
  type: string;
  size: number;
}

export function validateAvatarFile(file: FileLike): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file (JPEG, PNG, GIF or WebP).";
  if (file.size > MAX_AVATAR_BYTES) return "The image must be 5 MB or smaller.";
  return null;
}

export function validateProfile(values: { fullName: string }): { fullName?: string } {
  const errors: { fullName?: string } = {};
  if (values.fullName.trim().length === 0) errors.fullName = "Full name is required.";
  return errors;
}

export interface PasswordFields {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export type PasswordErrors = Partial<Record<keyof PasswordFields, string>>;

export function validatePasswordChange(values: PasswordFields): PasswordErrors {
  const errors: PasswordErrors = {};
  if (values.oldPassword.length === 0) errors.oldPassword = "Enter your current password.";
  if (values.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `The new password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (values.newPassword === values.oldPassword) {
    errors.newPassword = "The new password must differ from the current one.";
  }
  if (values.confirmNewPassword !== values.newPassword) errors.confirmNewPassword = "The passwords do not match.";
  return errors;
}

// Backend ErrorCode values for POST /api/users/change-password (keyed on the code, not on message text).
const WRONG_PASSWORD = 1011;
const PASSWORD_MISMATCH = 1010;
const PASSWORD_SAME = 1022;

/** Maps a change-password API failure to the field it belongs to, or a general message. */
export function mapPasswordApiError(error: { code?: number; message: string }): {
  field: keyof PasswordFields | "general";
  message: string;
} {
  switch (error.code) {
    case WRONG_PASSWORD:
      return { field: "oldPassword", message: error.message };
    case PASSWORD_SAME:
      return { field: "newPassword", message: error.message };
    case PASSWORD_MISMATCH:
      return { field: "confirmNewPassword", message: error.message };
    default:
      return { field: "general", message: error.message };
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
