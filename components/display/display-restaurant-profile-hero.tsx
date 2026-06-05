"use client";

import type { ReactNode } from "react";
import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { cn } from "@/lib/utils";

const logoClassName =
  "size-[4.75rem] shrink-0 border border-border shadow-sm ring-2 ring-card sm:size-20";

export function DisplayRestaurantProfileHero({
  name,
  avatarUrl,
  coverUrl,
  subtitle,
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  coverUrl: string | null | undefined;
  accentHex?: string | null;
  subtitle?: ReactNode;
  className?: string;
}) {
  const initials = displayRestaurantInitials(name);
  const hasCover = Boolean(coverUrl);

  if (!hasCover) {
    return (
      <section className={cn("bg-card px-5 py-5 sm:px-6 sm:py-6", className)}>
        <div className="flex items-center gap-3.5 sm:gap-4">
          <DisplayRestaurantLogo
            src={avatarUrl}
            initials={initials}
            alt={name}
            className={cn(logoClassName, !avatarUrl && "text-lg sm:text-xl")}
            imageClassName="p-0"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              {name}
            </h1>
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
      <div className="relative h-28 w-full overflow-hidden border-b border-border/40 sm:h-32">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={coverUrl!} alt="" className="size-full object-cover" />
      </div>

      <div className="relative px-5 sm:px-6">
        <DisplayRestaurantLogo
          src={avatarUrl}
          initials={initials}
          alt={name}
          className={cn(
            "absolute left-5 top-0 z-10 -translate-y-1/2 sm:left-6",
            logoClassName,
            !avatarUrl && "text-lg sm:text-xl",
          )}
          imageClassName="p-0"
        />
        <div
          className={cn(
            "flex items-center",
            subtitle ? "min-h-[4.5rem] sm:min-h-[4.75rem]" : "min-h-[3.25rem] sm:min-h-14",
          )}
        >
          <div className="size-[4.75rem] shrink-0 sm:size-20" aria-hidden />
          <div className="min-w-0 flex-1 pl-3.5 sm:pl-4">
            <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              {name}
            </h1>
            {subtitle ? (
              <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
