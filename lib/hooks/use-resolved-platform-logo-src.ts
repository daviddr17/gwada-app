"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/providers/theme-provider";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";

/** App-Logo passend zu Hell/Dunkel (Dark fällt auf Light-Logo zurück). */
export function useResolvedPlatformLogoSrc(): string | null {
  const branding = usePlatformAppBrandingOptional();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useMemo(() => {
    if (!mounted) {
      return resolvePlatformLogoSrc(branding, "light");
    }
    const theme = resolvedTheme === "dark" ? "dark" : "light";
    return resolvePlatformLogoSrc(branding, theme);
  }, [branding, mounted, resolvedTheme]);
}
