"use client";

import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useAppFaviconDisplay } from "@/lib/hooks/use-app-favicon-src";
import { cn } from "@/lib/utils";

const ICON_CLASS = "size-7 shrink-0 object-contain object-center md:size-8";

/**
 * Favicon / App-Icon in der Top-Chrome-Zeile (mittig im Header-Inset, nicht am Titel).
 */
export function AppChromeCenterFavicon({ className }: { className?: string }) {
  const branding = usePlatformAppBrandingOptional();
  const { src, onImageError } = useAppFaviconDisplay();

  if (!branding?.isReady || !src) {
    return null;
  }

  const appName = branding.appName ?? "App";

  return (
    <div
      className={cn(
        "flex h-full max-h-[var(--app-chrome-header-h)] shrink-0 items-center justify-center px-0.5",
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        className={ICON_CLASS}
        onError={onImageError}
      />
      <span className="sr-only">{appName}</span>
    </div>
  );
}
