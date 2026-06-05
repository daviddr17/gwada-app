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
import { RestaurantProfileBrandedCanvas } from "@/components/public/restaurant-profile-branded-canvas";
import { RestaurantPublicProfileLauncherSkeleton } from "@/components/public/restaurant-public-profile-launcher-skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";

type LauncherComponent = ComponentType<{
  profile: PublicRestaurantProfile;
  heroVisible?: boolean;
  logoIntro?: PublicProfileLogoIntro;
}>;

export function RestaurantPublicProfilePageShell({
  profile,
  gwadaIconSrc,
}: {
  profile: PublicRestaurantProfile;
  gwadaIconSrc: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const [Launcher, setLauncher] = useState<LauncherComponent | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [launcherReady, setLauncherReady] = useState(false);

  const launcherLoaded = launcherReady && Boolean(Launcher);
  const showSkeletonOverlay = !launcherLoaded;
  const showShimmer = useDeferredSkeleton(showSkeletonOverlay);
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
    <ProfilePublicDockProvider>
      <LazyMotion features={domAnimation}>
        <div className="relative flex h-dvh flex-col overflow-hidden">
          {showSkeletonOverlay ? (
            <>
              <RestaurantProfileBrandedCanvas accentHex={profile.accentHex} />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-b from-transparent to-background"
                aria-hidden
              />
            </>
          ) : null}

          {launcherLoaded && Launcher ? (
            <Launcher
              profile={profile}
              heroVisible
              logoIntro={logoIntro}
            />
          ) : null}

          {showSkeletonOverlay ? (
            <div className="pointer-events-none absolute inset-0 z-[2]">
              <RestaurantPublicProfileLauncherSkeleton
                profile={profile}
                showShimmer={showShimmer}
                showDockPlaceholder
              />
            </div>
          ) : null}
        </div>
      </LazyMotion>
    </ProfilePublicDockProvider>
  );
}
