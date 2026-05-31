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

export function passwordMeetsPolicy(password: string): boolean {
  if (password.length < 8) return false;
  const req = getPasswordRequirements(password);
  return req.lower && req.upper && req.digit && req.special;
}

export function getPasswordStrengthLevel(
  password: string,
): PasswordStrengthLevel {
  if (!password) return "weak";
  const req = getPasswordRequirements(password);
  const met = Object.values(req).filter(Boolean).length;
  if (met === 4 && password.length >= 10) return "strong";
  if (met >= 3 && password.length >= 8) return "medium";
  return "weak";
}

export function passwordStrengthBarWidth(level: PasswordStrengthLevel): string {
  switch (level) {
    case "strong":
      return "100%";
    case "medium":
      return "66%";
    default:
      return "33%";
  }
}

export function passwordStrengthBarClassName(
  level: PasswordStrengthLevel,
): string {
  switch (level) {
    case "strong":
      return "bg-emerald-500";
    case "medium":
      return "bg-yellow-500";
    default:
      return "bg-destructive";
  }
}
