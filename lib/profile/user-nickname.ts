/** URL-safe nickname for `profiles.nickname` (lowercase, hyphens/underscores). */
export function normalizeUserNicknameInput(input: string): string {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return raw.slice(0, 32);
}

export function validateUserNicknameInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const nickname = normalizeUserNicknameInput(trimmed);
  if (nickname.length < 2) {
    return "Nickname muss mindestens 2 Zeichen haben.";
  }
  return null;
}

export const USER_NICKNAME_TAKEN_MESSAGE =
  "Dieser Nickname ist bereits vergeben. Bitte einen anderen wählen.";
