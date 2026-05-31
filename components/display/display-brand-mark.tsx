"use client";

import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

/** Dezentes Gwada-/Plattform-Logo für Display-Oberflächen (Größe, nicht Transparenz). */
export function DisplayBrandMark({
  className,
  size = "sm",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const branding = usePlatformAppBrandingOptional();
  const src = useResolvedPlatformLogoSrc();
  const appName = branding?.appName ?? "gwada";

  if (!src) {
    return (
      <p
        className={cn(
          "font-medium tracking-tight text-muted-foreground",
          size === "md" ? "text-sm" : "text-xs",
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
        alt=""
        decoding="async"
        className={cn(
          "w-auto object-contain",
          size === "md" ? "h-7 max-w-[7rem]" : "h-5 max-w-[5.5rem]",
        )}
      />
    </div>
  );
}
