"use client";

import { useEffect } from "react";
import {
  faviconMimeTypeFromPath,
  withBrandingAssetCacheBust,
} from "@/lib/platform/branding-asset-url";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

const MANAGED_SELECTOR = 'link[data-platform-branding="favicon"]';

function upsertFaviconLink(rel: string, href: string, type?: string) {
  if (!document.head) return;

  const selector = `${MANAGED_SELECTOR}[rel="${rel}"]`;
  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    link.setAttribute("data-platform-branding", "favicon");
    document.head.appendChild(link);
  }
  if (link.href !== href) {
    link.href = href;
  }
  if (type) {
    link.type = type;
  } else {
    link.removeAttribute("type");
  }
}

function clearManagedFaviconLinks() {
  document.querySelectorAll(MANAGED_SELECTOR).forEach((el) => {
    if (el.isConnected) {
      el.remove();
    }
  });
}

/**
 * Client-Favicon aus Plattform-Einstellungen.
 * Nur eigene <link>-Tags — keine Next/React-Icons entfernen (verhindert removeChild-Crashes).
 */
export function PlatformFaviconSync() {
  const branding = usePlatformAppBrandingOptional();
  const href = withBrandingAssetCacheBust(
    branding?.faviconUrl ?? null,
    branding?.faviconPath ?? null,
  );
  const mime = faviconMimeTypeFromPath(branding?.faviconPath ?? null);

  useEffect(() => {
    if (!branding?.isReady) return;

    if (!href) {
      clearManagedFaviconLinks();
      return;
    }

    upsertFaviconLink("icon", href, mime);
    upsertFaviconLink("shortcut icon", href, mime);
  }, [branding?.isReady, href, mime]);

  return null;
}
