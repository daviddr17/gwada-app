"use client";

import { useLayoutEffect } from "react";
import {
  faviconMimeTypeFromPath,
  platformFaviconHref,
} from "@/lib/platform/branding-asset-url";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

const MANAGED_SELECTOR = 'link[data-platform-branding="favicon"]';
const ICON_SELECTOR =
  'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';

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

function applyDocumentFavicon(href: string, mime?: string) {
  upsertFaviconLink("icon", href, mime);
  upsertFaviconLink("shortcut icon", href, mime);
  upsertFaviconLink("apple-touch-icon", href, mime);

  document.querySelectorAll<HTMLLinkElement>(ICON_SELECTOR).forEach((link) => {
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

function readServerFaviconHref(): string | null {
  if (typeof document === "undefined") return null;
  const fromHtml = document.documentElement.getAttribute("data-platform-favicon");
  return fromHtml?.trim() || null;
}

/**
 * Hält Favicon-Links auf `/favicon.ico?v=…` (Rewrite → Plattform-PNG).
 * Entfernt Next.js-Dreieck (`favicon.*.ico`).
 */
export function PlatformFaviconSync({
  serverFaviconHref,
}: {
  serverFaviconHref?: string | null;
}) {
  const branding = usePlatformAppBrandingOptional();
  const href =
    platformFaviconHref(branding?.faviconPath ?? null) ??
    serverFaviconHref ??
    readServerFaviconHref();
  const mime = faviconMimeTypeFromPath(branding?.faviconPath ?? null);

  useLayoutEffect(() => {
    if (!href) return;
    applyDocumentFavicon(href, mime);
  }, [href, mime]);

  return null;
}
