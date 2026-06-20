"use client";

import type { ReactNode } from "react";
import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { cn } from "@/lib/utils";

const logoClassNameDefault =
  "size-10 shrink-0 border border-border/60 shadow-sm ring-1 ring-card sm:size-11";
const logoClassNameCompact =
  "size-8 shrink-0 border border-border/60 shadow-sm ring-1 ring-card sm:size-9";
const coverBannerClassName =
  "relative h-14 w-full overflow-hidden border-b border-border/40 sm:h-16";
const titleClassNameDefault =
  "text-lg font-semibold leading-tight tracking-tight sm:text-xl";
const titleClassNameCompact = "truncate text-sm font-medium sm:text-base";

export function DisplayRestaurantProfileHero({
  name,
  avatarUrl,
  coverUrl,
  subtitle,
  variant = "default",
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  coverUrl: string | null | undefined;
  accentHex?: string | null;
  subtitle?: ReactNode;
  /** Kompakt für PIN-Screen — kleineres Logo, kein Cover-Banner. */
  variant?: "default" | "compact";
  className?: string;
}) {
  const initials = displayRestaurantInitials(name);
  const compact = variant === "compact";
  const logoClassName = compact ? logoClassNameCompact : logoClassNameDefault;
  const hasCover = Boolean(coverUrl) && !compact;

  if (compact) {
    return (
      <section
        className={cn(
          "flex items-center gap-2.5 border-b border-border/40 px-4 py-3 sm:px-5",
          className,
        )}
      >
        <DisplayRestaurantLogo
          src={avatarUrl}
          initials={initials}
          alt={name}
          className={cn(logoClassName, !avatarUrl && "text-[10px] sm:text-xs")}
          imageClassName="p-0"
        />
        <div className="min-w-0 flex-1">
          <h1 className={titleClassNameCompact}>{name}</h1>
          {subtitle ? (
            <div className="mt-0.5 truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (!hasCover) {
    return (
      <section className={cn("bg-card px-4 py-3 sm:px-5 sm:py-4", className)}>
        <div className="flex items-center gap-3">
          <DisplayRestaurantLogo
            src={avatarUrl}
            initials={initials}
            alt={name}
            className={cn(logoClassName, !avatarUrl && "text-sm sm:text-base")}
            imageClassName="p-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className={titleClassNameDefault}>{name}</h1>
            {subtitle ? (
              <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={cn("bg-card", className)}>
      <div className={coverBannerClassName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl!} alt="" className="size-full object-cover" />
      </div>

      <div className="relative px-4 sm:px-5">
        <DisplayRestaurantLogo
          src={avatarUrl}
          initials={initials}
          alt={name}
          className={cn(
            "absolute left-4 top-0 z-10 -translate-y-1/2 sm:left-5",
            logoClassName,
            !avatarUrl && "text-sm sm:text-base",
          )}
          imageClassName="p-0"
        />
        <div
          className={cn(
            "flex items-center",
            subtitle ? "min-h-[2.75rem] sm:min-h-12" : "min-h-10 sm:min-h-11",
          )}
        >
          <div className="size-10 shrink-0 sm:size-11" aria-hidden />
          <div className="min-w-0 flex-1 pl-3">
            <h1 className={titleClassNameDefault}>{name}</h1>
            {subtitle ? (
              <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
