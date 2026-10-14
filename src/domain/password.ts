export const MIN_PASSWORD_LENGTH = 8;

/** Client-side check for a new password and its confirmation. */
export function passwordProblem(password: string, confirmation: string): "too_short" | "mismatch" | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "too_short";
  if (password !== confirmation) return "mismatch";
  return null;
}
