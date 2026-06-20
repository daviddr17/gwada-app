"use client";

import type { ReactNode } from "react";
import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import {
  displayRestaurantHeroCompactTitleClassName,
  displayRestaurantHeroTitleClassName,
  displayRestaurantLogoClassName,
  displayRestaurantLogoCompactClassName,
} from "@/lib/ui/display-restaurant-branding";
import { cn } from "@/lib/utils";

export function DisplayRestaurantProfileHero({
  name,
  avatarUrl,
  subtitle,
  variant = "default",
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  /** Unbenutzt — Cover auf dem Display entfällt (Platz für Funktionen). */
  coverUrl?: string | null | undefined;
  accentHex?: string | null;
  subtitle?: ReactNode;
  /** Kompakt für PIN-Screen. */
  variant?: "default" | "compact";
  className?: string;
}) {
  const initials = displayRestaurantInitials(name);
  const compact = variant === "compact";
  const logoClassName = compact
    ? displayRestaurantLogoCompactClassName
    : displayRestaurantLogoClassName;
  const titleClassName = compact
    ? displayRestaurantHeroCompactTitleClassName
    : displayRestaurantHeroTitleClassName;
  const sectionPadding = compact ? "px-4 py-2.5 sm:px-5" : "px-4 py-3 sm:px-5 sm:py-3.5";

  return (
    <section
      className={cn(
        "flex items-center gap-2.5 border-b border-border/40 bg-card",
        sectionPadding,
        className,
      )}
    >
      <DisplayRestaurantLogo
        src={avatarUrl}
        initials={initials}
        alt={name}
        size="sm"
        className={cn(logoClassName, !avatarUrl && "text-[10px] sm:text-xs")}
        imageClassName="!max-h-full !max-w-full p-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <h1 className={titleClassName}>{name}</h1>
        {subtitle ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
            {subtitle}
          </div>
        ) : null}
      </div>
    </section>
  );
}
