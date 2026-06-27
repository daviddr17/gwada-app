"use client";

import Link from "next/link";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useMarketingHeroLogoSrc } from "@/lib/hooks/use-marketing-hero-logo-src";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

type AuthScreenBrandLogoProps = {
  className?: string;
  /** Optionaler Link — z. B. Startseite auf der Login-Seite. */
  href?: string | null;
};

/** Logo über Auth-/Einladungs-Karten (Login, Einladung, …). */
export function AuthScreenBrandLogo({ className, href = null }: AuthScreenBrandLogoProps) {
  const branding = usePlatformAppBrandingOptional();
  const marketingSrc = useMarketingHeroLogoSrc();
  const resolvedSrc = useResolvedPlatformLogoSrc();
  const src = marketingSrc ?? resolvedSrc;
  const appName = branding?.appName?.trim() || "gwada";

  const mark = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={appName}
      decoding="async"
      className={cn(
        "h-10 w-auto max-w-[13rem] object-contain md:h-11",
        href && "transition-opacity hover:opacity-90",
      )}
    />
  ) : (
    <GwadaFaviconIcon
      size="md"
      className={cn("size-9", href && "transition-opacity hover:opacity-90")}
    />
  );

  return (
    <div className={cn("flex w-full justify-center", className)}>
      {href ? (
        <Link href={href} prefetch aria-label={appName}>
          {mark}
        </Link>
      ) : (
        mark
      )}
    </div>
  );
}

type AuthScreenShellProps = {
  children: React.ReactNode;
  className?: string;
  logoHref?: string | null;
};

export function AuthScreenShell({
  children,
  className,
  logoHref = null,
}: AuthScreenShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh w-full items-center justify-center p-4",
        className,
      )}
    >
      <div className="flex w-full max-w-md shrink-0 flex-col gap-4">
        <AuthScreenBrandLogo href={logoHref} />
        {children}
      </div>
    </div>
  );
}
