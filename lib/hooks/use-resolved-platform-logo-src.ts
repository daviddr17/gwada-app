"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeferredResolvedTheme } from "@/lib/hooks/use-deferred-resolved-theme";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";

/** App-Logo passend zu Hell/Dunkel (Dark fällt auf Light-Logo zurück). */
export function useResolvedPlatformLogoSrc(): string | null {
  const branding = usePlatformAppBrandingOptional();
  const deferredTheme = useDeferredResolvedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useMemo(() => {
    if (!mounted) {
      return resolvePlatformLogoSrc(branding, "light");
    }
    return resolvePlatformLogoSrc(branding, deferredTheme);
  }, [branding, mounted, deferredTheme]);
}
