"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { ModuleSubnavItem } from "@/components/layout/module-subnav";
import {
  applyModuleSubnavBackStack,
  modulePrefixFromSubnav,
  peekModuleSubnavBackTarget,
  recordModuleNavPath,
} from "@/lib/navigation/module-subnav-back";

/**
 * Chip-Untermenü Zurück: Ziel für nativen `<Link>` (wie Superadmin-Sidebar).
 */
export function useModuleSubnavBack(
  subnavItems: readonly ModuleSubnavItem[] | undefined,
) {
  const pathname = usePathname();

  useEffect(() => {
    if (!subnavItems?.length) return;
    const prefix = modulePrefixFromSubnav(subnavItems);
    if (!prefix) return;
    recordModuleNavPath(prefix, pathname);
  }, [pathname, subnavItems]);

  const backHref = useMemo(() => {
    if (!subnavItems?.length) return "/dashboard";
    return peekModuleSubnavBackTarget(subnavItems, pathname);
  }, [pathname, subnavItems]);

  const onBackNavigate = useCallback(() => {
    if (!subnavItems?.length) return;
    applyModuleSubnavBackStack(subnavItems, pathname);
  }, [pathname, subnavItems]);

  return { backHref, onBackNavigate };
}
