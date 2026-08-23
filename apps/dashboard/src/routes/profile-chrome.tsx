"use client";

import type { ComponentType, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppMain } from "@/components/layout/app-main";
import { RegisterModuleChrome } from "@/lib/contexts/app-module-chrome-context";
import { useMyRestaurantStaff } from "@/lib/hooks/use-my-restaurant-staff";
import { useStaffProfileVisibility } from "@/lib/hooks/use-staff-profile-visibility";
import {
  buildProfileNavItems,
  isProfileRouteAllowed,
  type ProfileNavLabelKey,
} from "@/lib/profile/profile-nav";
import { APP_ROUTES } from "@/lib/navigation/app-routes";

/** Profil-Modul-Chrome (früher Next layout). */
export function ProfileChrome({ children }: { children: ReactNode }) {
  const t = useTranslations("Profile");
  const tNav = useTranslations("Profile.nav");
  const pathname = usePathname();
  const router = useRouter();
  const { staff, loading: staffLoading } = useMyRestaurantStaff();
  const { visibility, loading: visibilityLoading } =
    useStaffProfileVisibility();

  const hasStaffProfile = Boolean(staff);
  const navReady = !staffLoading && !visibilityLoading;

  const navLabels = useMemo(() => {
    const keys: ProfileNavLabelKey[] = [
      "overview",
      "login",
      "notifications",
      "workHours",
      "schedule",
      "availability",
      "documents",
      "displayPin",
    ];
    return Object.fromEntries(keys.map((k) => [k, tNav(k)])) as Record<
      ProfileNavLabelKey,
      string
    >;
  }, [tNav]);

  const subnavItems = useMemo(
    () =>
      buildProfileNavItems({
        visibility,
        hasStaffProfile,
        labels: navLabels,
      }),
    [visibility, hasStaffProfile, navLabels],
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
    router.replace(APP_ROUTES.profile.personal);
  }, [navReady, pathname, visibility, hasStaffProfile, router]);

  return (
    <>
      <RegisterModuleChrome
        title={t("title")}
        subnavAriaLabel={t("subnavAriaLabel")}
        subnavItems={subnavItems}
      />
      <AppMain>{children}</AppMain>
    </>
  );
}

export function wrapProfilePage(Page: ComponentType): ComponentType {
  function Wrapped() {
    return (
      <ProfileChrome>
        <Page />
      </ProfileChrome>
    );
  }
  Wrapped.displayName = `ProfileChrome(${Page.displayName ?? Page.name ?? "Page"})`;
  return Wrapped;
}
