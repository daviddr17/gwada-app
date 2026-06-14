"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeferredResolvedTheme } from "@/lib/hooks/use-deferred-resolved-theme";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { platformMarketingLogoHref } from "@/lib/platform/platform-marketing-logo-url";

/** Hero-LCP: optimiertes WebP (~240px) statt Vollbild aus Storage. */
export function useMarketingHeroLogoSrc(): string | null {
  const branding = usePlatformAppBrandingOptional();
  const deferredTheme = useDeferredResolvedTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useMemo(() => {
    const theme = !mounted ? "light" : deferredTheme;
    return platformMarketingLogoHref(
      branding,
      theme === "dark" ? "dark" : "light",
    );
  }, [branding, mounted, deferredTheme]);
}
