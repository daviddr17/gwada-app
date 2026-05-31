"use client";

import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { cn } from "@/lib/utils";

export function DisplayRestaurantHeading({
  name,
  avatarUrl,
  subtitle,
  centered = false,
  size = "lg",
  logoSize = "em",
  className,
}: {
  name: string;
  avatarUrl: string | null | undefined;
  subtitle?: React.ReactNode;
  centered?: boolean;
  size?: "md" | "lg";
  /** Feste Größe wie `DisplayRoundAvatar` sm (36px), z. B. Modul-Header. */
  logoSize?: "em" | "avatar-sm";
  className?: string;
}) {
  const initials = displayRestaurantInitials(name);
  const titleClass =
    size === "lg"
      ? "text-2xl font-semibold leading-none tracking-tight sm:text-3xl"
      : "text-lg font-semibold leading-none tracking-tight";

  const logo =
    logoSize === "avatar-sm" ? (
      <DisplayRestaurantLogo
        src={avatarUrl}
        initials={initials}
        alt={name}
        size="sm"
        className={cn(
          "shrink-0",
          !avatarUrl && "font-semibold text-muted-foreground",
        )}
        imageClassName="p-1"
      />
    ) : (
      <span
        className={cn(
          titleClass,
          "inline-flex shrink-0 items-center justify-center leading-none",
        )}
      >
        <DisplayRestaurantLogo
          src={avatarUrl}
          initials={initials}
          alt={name}
          size="sm"
          className={cn(
            "min-w-[1em] !size-[1em] rounded-full ![font-size:1em]",
            !avatarUrl && "!text-[0.45em] font-semibold text-muted-foreground",
          )}
          imageClassName="!object-cover !p-0"
        />
      </span>
    );

  const rowGap = logoSize === "avatar-sm" ? "gap-2" : "gap-2.5";
  const subtitlePad =
    logoSize === "avatar-sm"
      ? "pl-11"
      : "pl-[calc(1em+0.625rem)]";

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex min-w-0 items-center",
          rowGap,
          centered && "justify-center",
        )}
      >
        {logo}
        <h1 className={cn("min-w-0 truncate", titleClass)}>{name}</h1>
      </div>
      {subtitle ? (
        <div
          className={cn(
            "mt-1 truncate text-sm text-muted-foreground",
            centered ? "text-center" : subtitlePad,
          )}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
