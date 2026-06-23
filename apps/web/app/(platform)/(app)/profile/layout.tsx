"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useStaffProfileVisibility } from "@/lib/hooks/use-staff-profile-visibility";
import {
  buildProfileNavItems,
  isProfileRouteAllowed,
} from "@/lib/profile/profile-nav";

export default function ProfileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, loading: staffLoading } = useMyRestaurantStaff();
  const { visibility, loading: visibilityLoading } =
    useStaffProfileVisibility();

  const hasStaffProfile = Boolean(staff);
  const navReady = !staffLoading && !visibilityLoading;

  const subnavItems = useMemo(
    () =>
      buildProfileNavItems({
        visibility,
        hasStaffProfile,
      }),
    [visibility, hasStaffProfile],
  );

  useEffect(() => {
    if (!navReady) return;
    if (
      isProfileRouteAllowed({
        pathname,
        visibility,
        hasStaffProfile,
      })
    ) {
      return;
    }
    router.replace("/profile/persoenliche-daten");
  }, [navReady, pathname, visibility, hasStaffProfile, router]);

  return (
    <>
      <RegisterModuleChrome
        title="Profil"
        subnavAriaLabel="Profilbereiche"
        subnavItems={subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}
