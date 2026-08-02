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
import { useMyRestaurants } from "@/lib/hooks/use-my-restaurants";
import { useWorkspaceAuthSession } from "@/lib/contexts/workspace-auth-session-context";
import { useWorkspaceRestaurantContext } from "@/lib/contexts/workspace-restaurant-context";
import { DEFAULT_APP_LOCALE, normalizeAppLocale } from "@/i18n/config";
import type { PersonalOnboardingDraft } from "@/lib/onboarding/personal-onboarding-steps";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PersonalOnboardingContextValue = {
  openWizard: () => void;
  closeWizard: () => void;
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
  const { ready: workspaceReady, restaurantId } =
    useWorkspaceRestaurantContext();
  const { rows, loading: restaurantsLoading } = useMyRestaurants();

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
    if (!authReady || !workspaceReady || restaurantsLoading || !profileChecked) {
      return;
    }
    if (!user) return;
    if (autoPrompted) return;

    // Restaurant-Setup zuerst (neuer Inhaber ohne Mandant).
    if (rows.length === 0 && !restaurantId) {
      return;
    }

    if (!needsOnboarding) {
      setAutoPrompted(true);
      return;
    }

    setRequired(true);
    setOpen(true);
    setAutoPrompted(true);
  }, [
    authReady,
    workspaceReady,
    restaurantsLoading,
    profileChecked,
    user,
    restaurantId,
    rows.length,
    needsOnboarding,
    autoPrompted,
  ]);

  const value = useMemo(
    () => ({ openWizard, closeWizard }),
    [openWizard, closeWizard],
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
