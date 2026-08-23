"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PersonalOnboardingOverlay } from "@/components/onboarding/personal-onboarding-overlay";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { DEFAULT_APP_LOCALE, normalizeAppLocale } from "@/i18n/config";
import type { PersonalOnboardingDraft } from "@/lib/onboarding/personal-onboarding-steps";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PersonalOnboardingContextValue = {
  openWizard: () => void;
  closeWizard: () => void;
  /** Profile row loaded (or signed out). */
  profileReady: boolean;
  /** User still needs the personal wizard. */
  needsOnboarding: boolean;
  /** Overlay currently visible. */
  isOpen: boolean;
};

const PersonalOnboardingContext =
  createContext<PersonalOnboardingContextValue | null>(null);

export function usePersonalOnboardingOptional(): PersonalOnboardingContextValue | null {
  return useContext(PersonalOnboardingContext);
}

export function PersonalOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, ready: authReady } = useWorkspaceAuthSession();

  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(false);
  const [autoPrompted, setAutoPrompted] = useState(false);
  const [seed, setSeed] = useState<Partial<PersonalOnboardingDraft>>({});
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  const openWizard = useCallback(() => {
    setRequired(false);
    setOpen(true);
  }, []);

  const closeWizard = useCallback(() => {
    setOpen(false);
    setRequired(false);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProfileChecked(false);
      setNeedsOnboarding(false);
      setAutoPrompted(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const sb = createSupabaseBrowserClient();
      const { data: profile } = await sb
        .from("profiles")
        .select(
          "given_name, family_name, locale, phone, personal_onboarding_completed_at",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const completed = Boolean(profile?.personal_onboarding_completed_at);
      setNeedsOnboarding(!completed);
      setSeed({
        locale: profile?.locale
          ? normalizeAppLocale(profile.locale)
          : DEFAULT_APP_LOCALE,
        firstName: profile?.given_name?.trim() ?? "",
        lastName: profile?.family_name?.trim() ?? "",
        phone: profile?.phone?.trim() ?? "",
      });
      setProfileChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !profileChecked) return;
    if (!user) return;
    if (autoPrompted) return;

    if (!needsOnboarding) {
      setAutoPrompted(true);
      return;
    }

    // Language + profile first — restaurant setup waits until this finishes.
    setRequired(true);
    setOpen(true);
    setAutoPrompted(true);
  }, [authReady, profileChecked, user, needsOnboarding, autoPrompted]);

  const value = useMemo(
    () => ({
      openWizard,
      closeWizard,
      profileReady: !authReady ? false : !user ? true : profileChecked,
      needsOnboarding,
      isOpen: open,
    }),
    [
      openWizard,
      closeWizard,
      authReady,
      user,
      profileChecked,
      needsOnboarding,
      open,
    ],
  );

  return (
    <PersonalOnboardingContext.Provider value={value}>
      {children}
      <PersonalOnboardingOverlay
        open={open}
        required={required && needsOnboarding}
        seed={seed}
        onOpenChange={(next) => {
          if (!next && required && needsOnboarding) return;
          setOpen(next);
          if (!next) setRequired(false);
        }}
        onCompleted={() => {
          setNeedsOnboarding(false);
          setRequired(false);
        }}
      />
    </PersonalOnboardingContext.Provider>
  );
}
