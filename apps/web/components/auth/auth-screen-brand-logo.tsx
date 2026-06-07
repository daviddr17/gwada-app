"use client";

import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

type AuthScreenBrandLogoProps = {
  className?: string;
};

/** Logo über Auth-/Einladungs-Karten (Login, Einladung, …). */
export function AuthScreenBrandLogo({ className }: AuthScreenBrandLogoProps) {
  const branding = usePlatformAppBrandingOptional();
  const src = useResolvedPlatformLogoSrc();
  const appName = branding?.appName ?? "gwada";

  if (!src) {
    return (
      <p
        className={cn(
          "text-center text-2xl font-semibold tracking-tight text-foreground",
          className,
        )}
      >
        {appName}
      </p>
    );
  }

  return (
    <div className={cn("flex justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={appName}
        decoding="async"
        className="h-10 w-auto max-w-[12rem] object-contain"
      />
    </div>
  );
}

type AuthScreenShellProps = {
  children: React.ReactNode;
  className?: string;
};

export function AuthScreenShell({ children, className }: AuthScreenShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-dvh w-full items-center justify-center p-4",
        className,
      )}
    >
      <div className="flex w-full max-w-md shrink-0 flex-col gap-5">
        <AuthScreenBrandLogo />
        {children}
      </div>
    </div>
  );
}
