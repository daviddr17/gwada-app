import type { AppLocale } from "@/i18n/config";
import { DEFAULT_APP_LOCALE } from "@/i18n/config";

export const PERSONAL_ONBOARDING_STEPS = [
  "welcome",
  "language",
  "identity",
  "contact",
  "done",
] as const;

export type PersonalOnboardingStep =
  (typeof PERSONAL_ONBOARDING_STEPS)[number];

export type PersonalOnboardingDraft = {
  locale: AppLocale;
  firstName: string;
  lastName: string;
  phone: string;
};

export function createEmptyPersonalOnboardingDraft(
  seed?: Partial<PersonalOnboardingDraft>,
): PersonalOnboardingDraft {
  return {
    locale: seed?.locale ?? DEFAULT_APP_LOCALE,
    firstName: seed?.firstName?.trim() ?? "",
    lastName: seed?.lastName?.trim() ?? "",
    phone: seed?.phone?.trim() ?? "",
  };
}

export function personalOnboardingStepIndex(
  step: PersonalOnboardingStep,
): number {
  return PERSONAL_ONBOARDING_STEPS.indexOf(step);
}

export const PERSONAL_ONBOARDING_PROGRESS_STEPS: PersonalOnboardingStep[] = [
  "language",
  "identity",
  "contact",
];
