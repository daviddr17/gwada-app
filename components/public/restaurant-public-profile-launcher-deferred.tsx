"use client";

import dynamic from "next/dynamic";
import { RestaurantPublicProfileLauncherSkeleton } from "@/components/public/restaurant-public-profile-launcher-skeleton";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";

const RestaurantPublicProfileAppLauncher = dynamic(
  () =>
    import("@/components/public/restaurant-public-profile-app-launcher").then(
      (mod) => mod.RestaurantPublicProfileAppLauncher,
    ),
  {
    loading: () => <RestaurantPublicProfileLauncherSkeleton />,
    ssr: false,
  },
);

export function RestaurantPublicProfileLauncherDeferred({
  profile,
}: {
  profile: PublicRestaurantProfile;
}) {
  return <RestaurantPublicProfileAppLauncher profile={profile} />;
}
