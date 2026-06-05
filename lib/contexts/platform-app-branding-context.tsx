"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { fetchPublicPlatformAppBranding } from "@/lib/superadmin/platform-app-settings-api";
import {
  DEFAULT_PLATFORM_APP_NAME,
  type PlatformAppBranding,
} from "@/lib/types/platform-app-settings";

type PlatformAppBrandingContextValue = {
  appName: string;
  logoUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  logoPath: string | null;
  logoDarkPath: string | null;
  faviconPath: string | null;
  isReady: boolean;
  refresh: () => Promise<void>;
  applyBranding: (next: PlatformAppBranding) => void;
};

const PlatformAppBrandingContext =
  createContext<PlatformAppBrandingContextValue | null>(null);

export function PlatformAppBrandingProvider({
  children,
  initialBranding,
}: {
  children: React.ReactNode;
  initialBranding?: PlatformAppBranding | null;
}) {
  const [appName, setAppName] = useState(
    () => initialBranding?.appName?.trim() || DEFAULT_PLATFORM_APP_NAME,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(
    () => initialBranding?.logoUrl ?? null,
  );
  const [logoDarkUrl, setLogoDarkUrl] = useState<string | null>(
    () => initialBranding?.logoDarkUrl ?? null,
  );
  const [faviconUrl, setFaviconUrl] = useState<string | null>(
    () => initialBranding?.faviconUrl ?? null,
  );
  const [logoPath, setLogoPath] = useState<string | null>(
    () => initialBranding?.logoPath ?? null,
  );
  const [logoDarkPath, setLogoDarkPath] = useState<string | null>(
    () => initialBranding?.logoDarkPath ?? null,
  );
  const [faviconPath, setFaviconPath] = useState<string | null>(
    () => initialBranding?.faviconPath ?? null,
  );
  const [isReady, setIsReady] = useState(() => Boolean(initialBranding));

  const applyBranding = useCallback((next: PlatformAppBranding) => {
    setAppName(next.appName?.trim() || DEFAULT_PLATFORM_APP_NAME);
    setLogoUrl(next.logoUrl);
    setLogoDarkUrl(next.logoDarkUrl);
    setFaviconUrl(next.faviconUrl);
    setLogoPath(next.logoPath ?? null);
    setLogoDarkPath(next.logoDarkPath ?? null);
    setFaviconPath(next.faviconPath ?? null);
  }, []);

  const refresh = useCallback(async () => {
    const data = await fetchPublicPlatformAppBranding();
    applyBranding(data);
    setIsReady(true);
  }, [applyBranding]);

  useEffect(() => {
    if (initialBranding) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchPublicPlatformAppBranding();
        if (cancelled) return;
        applyBranding(data);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBranding, initialBranding]);

  const value = useMemo(
    () => ({
      appName,
      logoUrl,
      logoDarkUrl,
      faviconUrl,
      logoPath,
      logoDarkPath,
      faviconPath,
      isReady,
      refresh,
      applyBranding,
    }),
    [
      appName,
      logoUrl,
      logoDarkUrl,
      faviconUrl,
      logoPath,
      logoDarkPath,
      faviconPath,
      isReady,
      refresh,
      applyBranding,
    ],
  );

  return (
    <PlatformAppBrandingContext.Provider value={value}>
      {children}
    </PlatformAppBrandingContext.Provider>
  );
}

export function usePlatformAppBranding(): PlatformAppBrandingContextValue {
  const ctx = useContext(PlatformAppBrandingContext);
  if (!ctx) {
    throw new Error(
      "usePlatformAppBranding must be used within PlatformAppBrandingProvider",
    );
  }
  return ctx;
}

export function usePlatformAppBrandingOptional(): PlatformAppBrandingContextValue | null {
  return useContext(PlatformAppBrandingContext);
}
