"use client";

import { LazyMotion, domAnimation, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from "react";
import type { PublicProfileLogoIntro } from "@/components/public/public-profile-logo-crossfade";
import { ProfilePublicDockProvider } from "@/components/public/profile-public-dock-bridge";
import { Skeleton } from "@/components/ui/skeleton";
import { RestaurantUsageBeacon } from "@/components/insights/restaurant-usage-beacon";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { PlatformAppBrandingProvider } from "@/lib/contexts/platform-app-branding-context";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";

type LauncherComponent = ComponentType<{
  profile: PublicRestaurantProfile;
  heroVisible?: boolean;
  logoIntro?: PublicProfileLogoIntro;
}>;

export function RestaurantPublicProfilePageShell({
  profile,
  gwadaIconSrc,
  initialBranding,
  ssrHero = false,
}: {
  profile: PublicRestaurantProfile;
  gwadaIconSrc: string | null;
  initialBranding?: PlatformAppBranding | null;
  /** Hero liegt bereits als RSC im HTML — Shell liefert nur Dock/Launcher. */
  ssrHero?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [Launcher, setLauncher] = useState<LauncherComponent | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [launcherReady, setLauncherReady] = useState(false);

  const launcherLoaded = launcherReady && Boolean(Launcher);
  const showDockSkeleton = !launcherLoaded;
  const showShimmer = useDeferredSkeleton(showDockSkeleton);
  const skipIntro = reduceMotion || !gwadaIconSrc;

  useEffect(() => {
    let cancelled = false;
    void import("@/components/public/restaurant-public-profile-app-launcher").then(
      (mod) => {
        if (cancelled) return;
        setLauncher(() => mod.RestaurantPublicProfileAppLauncher);
        setLauncherReady(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipIntro) {
      setIntroDone(true);
    }
  }, [skipIntro]);

  useEffect(() => {
    if (!ssrHero || !launcherLoaded) return;
    const el = document.querySelector("[data-public-profile-ssr-hero]");
    if (el instanceof HTMLElement) {
      el.hidden = true;
    }
  }, [ssrHero, launcherLoaded]);

  const handleIntroComplete = useCallback(() => {
    setIntroDone(true);
  }, []);

  const logoIntro: PublicProfileLogoIntro | undefined =
    skipIntro || !gwadaIconSrc
      ? undefined
      : {
          gwadaIconSrc,
          active: !introDone,
          onComplete: handleIntroComplete,
        };

  return (
    <PlatformAppBrandingProvider initialBranding={initialBranding}>
      <ProfilePublicDockProvider>
        <RestaurantUsageBeacon
          slug={profile.slug}
          source="profile"
          dimension="view"
        />
        <LazyMotion features={domAnimation}>
          {launcherLoaded && Launcher ? (
            <div className="fixed inset-0 z-10">
              <Launcher
                profile={profile}
                heroVisible
                logoIntro={logoIntro}
              />
            </div>
          ) : showDockSkeleton ? (
            <div
              className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[2] flex justify-center px-4"
              aria-hidden
            >
              {showShimmer ? (
                <Skeleton className="h-[3.75rem] w-[min(100%,18rem)] rounded-full" />
              ) : (
                <div className="h-[3.75rem] w-[min(100%,18rem)] rounded-full bg-muted/35" />
              )}
            </div>
          ) : null}
        </LazyMotion>
      </ProfilePublicDockProvider>
    </PlatformAppBrandingProvider>
  );
}
