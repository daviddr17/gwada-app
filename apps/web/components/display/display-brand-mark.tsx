"use client";

import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

/** Dezentes Gwada-/Plattform-Logo für Display-Oberflächen (Größe, nicht Transparenz). */
export function DisplayBrandMark({
  className,
  size = "sm",
  layout = "default",
}: {
  className?: string;
  size?: "sm" | "md";
  /** Fußzeile Display: nur Wortmarke. */
  layout?: "default" | "footer";
}) {
  const branding = usePlatformAppBrandingOptional();
  const src = useResolvedPlatformLogoSrc();
  const appName = branding?.appName ?? "gwada";

  if (layout === "footer") {
    return (
      <div className={cn("flex shrink-0 items-center", className)}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            decoding="async"
            className="h-4 w-auto max-w-[4.75rem] shrink-0 object-contain object-center"
          />
        ) : (
          <p className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground">
            {appName}
          </p>
        )}
      </div>
    );
  }

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
