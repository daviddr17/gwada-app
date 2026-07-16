"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import {
  faviconMimeTypeFromPath,
  platformFaviconHref,
} from "@/lib/platform/branding-asset-url";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

const MANAGED_SELECTOR = 'link[data-platform-branding="favicon"]';
const TAB_ICON_SELECTOR = 'link[rel="icon"], link[rel="shortcut icon"]';
const APPLE_ICON_SELECTOR = 'link[rel="apple-touch-icon"]';

function isLegacyNextFaviconLink(link: HTMLLinkElement): boolean {
  const href = link.getAttribute("href") ?? "";
  return (
    /favicon\.[a-z0-9~_-]+\.ico/i.test(href) ||
    (href.includes("/favicon.ico") &&
      !href.includes("v=") &&
      !href.startsWith("/api/platform/favicon"))
  );
}

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
  link.href = href;
  if (type) link.type = type;
  else link.removeAttribute("type");
}

function applyTabFavicons(href: string, mime?: string) {
  upsertFaviconLink("icon", href, mime);
  upsertFaviconLink("shortcut icon", href, mime);

  document.querySelectorAll<HTMLLinkElement>(TAB_ICON_SELECTOR).forEach((link) => {
    if (link.getAttribute("data-platform-branding") === "favicon") return;
    if (isLegacyNextFaviconLink(link)) {
      link.remove();
      return;
    }
    link.href = href;
    if (mime) link.type = mime;
    else link.removeAttribute("type");
  });
}

/** Marketing/Auth: apple-touch = Favicon. PWA-Zonen: Zone-Metadata / PwaSetup. */
function applyAppleTouchForMarketing(href: string, mime?: string) {
  upsertFaviconLink("apple-touch-icon", href, mime);
  const managed = document.querySelector<HTMLLinkElement>(
    `${MANAGED_SELECTOR}[rel="apple-touch-icon"]`,
  );
  if (managed) {
    managed.sizes = "180x180";
  }

  document.querySelectorAll<HTMLLinkElement>(APPLE_ICON_SELECTOR).forEach((link) => {
    if (link.getAttribute("data-platform-branding") === "favicon") return;
    if (isLegacyNextFaviconLink(link)) {
      link.remove();
    }
  });
}

function clearManagedAppleTouch() {
  document
    .querySelectorAll<HTMLLinkElement>(`${MANAGED_SELECTOR}[rel="apple-touch-icon"]`)
    .forEach((link) => link.remove());
}

function isPwaZonePath(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/display" ||
    pathname.startsWith("/display/")
  );
}

function readServerFaviconHref(): string | null {
  if (typeof document === "undefined") return null;
  const fromHtml = document.documentElement.getAttribute("data-platform-favicon");
  return fromHtml?.trim() || null;
}

/**
 * Hält Tab-Favicons auf `/favicon.ico?v=…`.
 * `apple-touch-icon` nur außerhalb Dashboard/Display — sonst überschreibt es PWA-Icons.
 */
export function PlatformFaviconSync({
  serverFaviconHref,
}: {
  serverFaviconHref?: string | null;
}) {
  const pathname = usePathname() ?? "";
  const branding = usePlatformAppBrandingOptional();
  const href =
    platformFaviconHref(branding?.faviconPath ?? null) ??
    serverFaviconHref ??
    readServerFaviconHref();
  const mime = faviconMimeTypeFromPath(branding?.faviconPath ?? null);
  const inPwaZone = isPwaZonePath(pathname);

  useLayoutEffect(() => {
    if (!href) return;
    applyTabFavicons(href, mime);
    if (inPwaZone) {
      clearManagedAppleTouch();
    } else {
      applyAppleTouchForMarketing(href, mime);
    }
  }, [href, mime, inPwaZone]);

  return null;
}
