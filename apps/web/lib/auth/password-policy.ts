export type PasswordRequirementKey = "lower" | "upper" | "digit" | "special";

export type PasswordRequirements = Record<PasswordRequirementKey, boolean>;

export type PasswordStrengthLevel = "weak" | "medium" | "strong";

export type PasswordRequirementItem = {
  key: PasswordRequirementKey | "length";
  label: string;
  test: (password: string) => boolean;
};

export const PASSWORD_REQUIREMENT_ITEMS: PasswordRequirementItem[] = [
  {
    key: "length",
    label: "Mindestens 8 Zeichen",
    test: (password) => password.length >= 8,
  },
  {
    key: "lower",
    label: "Kleinbuchstabe",
    test: (password) => /[a-z]/.test(password),
  },
  {
    key: "upper",
    label: "Großbuchstabe",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    key: "digit",
    label: "Zahl",
    test: (password) => /[0-9]/.test(password),
  },
  {
    key: "special",
    label: "Sonderzeichen",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

export const PASSWORD_POLICY_ERROR_MESSAGE =
  "Das Passwort muss mindestens einen Kleinbuchstaben, einen Großbuchstaben, eine Zahl und ein Sonderzeichen enthalten.";

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

/** Nur bei Registrierung und Passwort-Änderung — nicht beim Login. */
export function passwordMeetsPolicy(password: string): boolean {
  if (password.length < 8) return false;
  const req = getPasswordRequirements(password);
  return req.lower && req.upper && req.digit && req.special;
}

/** 0–6: length (≥8, ≥12) + four character-class requirements. */
export function getPasswordStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  const req = getPasswordRequirements(password);
  score += Object.values(req).filter(Boolean).length;
  return score;
}

export function getPasswordStrengthLevel(
  password: string,
): PasswordStrengthLevel {
  const score = getPasswordStrengthScore(password);
  if (score >= 5) return "strong";
  if (score >= 3) return "medium";
  return "weak";
}

/** Smooth fill while typing (not only three hard steps). */
export function passwordStrengthBarWidth(password: string): string {
  if (!password) return "0%";
  const score = Math.max(getPasswordStrengthScore(password), 1);
  return `${Math.round((score / 6) * 100)}%`;
}

export function passwordStrengthLabel(level: PasswordStrengthLevel): string {
  switch (level) {
    case "strong":
      return "Stark";
    case "medium":
      return "Mittel";
    default:
      return "Schwach";
  }
}

export function passwordStrengthBarClassName(
  level: PasswordStrengthLevel,
): string {
  switch (level) {
    case "strong":
      return "bg-emerald-500";
    case "medium":
      return "bg-amber-500";
    default:
      return "bg-destructive";
  }
}

export function passwordStrengthLabelClassName(
  level: PasswordStrengthLevel,
): string {
  switch (level) {
    case "strong":
      return "text-emerald-600 dark:text-emerald-400";
    case "medium":
      return "text-amber-600 dark:text-amber-400";
    default:
      return "text-destructive";
  }
}
