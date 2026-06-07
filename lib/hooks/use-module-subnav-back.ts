"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import {
  modulePrefixFromSubnav,
  recordModuleNavPath,
  resolveModuleSubnavBackTarget,
} from "@/lib/navigation/module-subnav-back";
import { navigateAppPath } from "@/lib/navigation/app-zone-navigation";

/**
 * Zurück im Chip-Untermenü: Modul-interne Historie statt `router.back()`
 * (vermeidet „page couldn't load“ durch Login/OAuth/externe History).
 */
export function useModuleSubnavBack(
  subnavItems: readonly ModuleSubnavItem[] | undefined,
) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!subnavItems?.length) return;
    const prefix = modulePrefixFromSubnav(subnavItems);
    if (!prefix) return;
    recordModuleNavPath(prefix, pathname);
  }, [pathname, subnavItems]);

  const goBack = useCallback(() => {
    if (!subnavItems?.length) {
      navigateAppPath(router, pathname, "/dashboard");
      return;
    }
    const target = resolveModuleSubnavBackTarget(subnavItems, pathname);
    navigateAppPath(router, pathname, target);
  }, [pathname, router, subnavItems]);

  return goBack;
}
