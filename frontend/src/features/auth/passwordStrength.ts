export interface PasswordStrength {
  score: number;
  width: string;
  color: string;
  label: string;
}

export const PASSWORD_STRENGTH_LEVELS = [
  { width: "20%", color: "#f87171", label: "Rất yếu" },
  { width: "40%", color: "#fb923c", label: "Yếu" },
  { width: "60%", color: "#facc15", label: "Trung bình" },
  { width: "80%", color: "#4ade80", label: "Mạnh" },
  { width: "100%", color: "#22c55e", label: "Rất mạnh" },
] as const;

/**
 * Calculates visual password strength score (1-5) matching V1 QuizHub UI.
 * Note: This is an advisory visual helper only and does not override backend validation policy.
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return {
      score: 0,
      width: "0%",
      color: "#f87171",
      label: "",
    };
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const safeScore = Math.max(1, Math.min(5, score));
  const level = PASSWORD_STRENGTH_LEVELS[safeScore - 1]!;

  return {
    score: safeScore,
    width: level.width,
    color: level.color,
    label: level.label,
  };
}
