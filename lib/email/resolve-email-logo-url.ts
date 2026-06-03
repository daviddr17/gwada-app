import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";

/** Absolute Logo-URL für E-Mails (Apple Mail, Gmail, …). */
export function resolveEmailLogoAbsoluteUrl(
  origin: string,
  branding: Pick<
    PlatformAppBranding,
    "logoUrl" | "logoPath" | "logoDarkUrl" | "logoDarkPath"
  >,
): string | null {
  const src = resolvePlatformLogoSrc(branding, "light");
  if (!src?.trim()) return null;
  const trimmed = src.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = origin.replace(/\/+$/, "");
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
