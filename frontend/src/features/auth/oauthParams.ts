// OAuth2AuthenticationSuccessHandler redirects a brand-new Google user to
//   /oauth2-choose-role.html?email=<email>&fullName=<base64(UTF-8 name)>&avatarUrl=<picture>
// These values arrive in the URL, so they are untrusted: they are validated here and only ever rendered as text.

export interface ChooseRoleParams {
  email: string;
  fullName: string;
  /** Empty string when absent or not an https URL. */
  avatarUrl: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Decodes the backend's standard-base64 UTF-8 name. The backend builds the URL with encode(), which leaves a
 * literal "+" unescaped, and URLSearchParams turns "+" into a space - so spaces are mapped back to "+" first
 * (a real name's base64 never contains a space). URL-safe base64 is accepted too. Anything that fails to
 * decode falls back to the raw value rather than throwing.
 */
export function decodeBase64Name(value: string): string {
  const normalized = value.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

export function parseChooseRoleParams(params: URLSearchParams): ChooseRoleParams | null {
  const email = params.get("email")?.trim() ?? "";
  if (!EMAIL_PATTERN.test(email)) return null;

  const encodedName = params.get("fullName");
  const fullName = (encodedName ? decodeBase64Name(encodedName) : email).trim() || email;

  const rawAvatar = params.get("avatarUrl") ?? "";
  const avatarUrl = /^https:\/\//i.test(rawAvatar) ? rawAvatar : "";

  return { email, fullName, avatarUrl };
}
