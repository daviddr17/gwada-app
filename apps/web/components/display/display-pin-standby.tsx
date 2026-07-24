"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DisplayBrandedBackground } from "@/components/display/display-branded-background";
import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { displayRestaurantLogoPinClassName } from "@/lib/ui/display-restaurant-branding";
import { cn } from "@/lib/utils";

export function DisplayPinStandbyBackground({
  accentHex,
  className,
}: {
  accentHex: string;
  className?: string;
}) {
  return (
    <DisplayBrandedBackground
      accentHex={accentHex}
      intensity="subtle"
      className={className}
    />
  );
}

function useStandbyClock(timezone: string) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
      }).format(now),
    [now, timezone],
  );

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: timezone,
      }).format(now),
    [now, timezone],
  );

  return { timeLabel, dateLabel };
}

export function DisplayPinStandbyClock({
  className,
}: {
  className?: string;
}) {
  const timezone = useDisplayRestaurantTimezone();
  const { timeLabel, dateLabel } = useStandbyClock(timezone);

  return (
    <div className={cn("select-none text-center", className)}>
      <p className="text-[clamp(2rem,min(11vw,7.5dvh),4.25rem)] font-extralight leading-none tracking-tight tabular-nums text-foreground">
        {timeLabel}
      </p>
      <p className="mt-[clamp(0.25rem,0.9dvh,0.5rem)] text-[clamp(0.85rem,1.9dvh,1.1rem)] font-medium capitalize text-foreground/85">
        {dateLabel}
      </p>
    </div>
  );
}

/** Profil-Mesh + Uhr für Display-PIN / Sperrbildschirm. */
export function DisplayPinStandbyScene({
  accentHex,
  restaurantName,
  restaurantAvatarUrl,
  enabled = true,
  className,
  children,
}: {
  accentHex: string;
  restaurantName?: string | null;
  restaurantAvatarUrl?: string | null;
  enabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  const trimmedName = restaurantName?.trim() ?? "";
  const showBrand = Boolean(trimmedName) || Boolean(restaurantAvatarUrl);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <DisplayPinStandbyBackground accentHex={accentHex} />
      <div
        className={cn(
          // Kompakter Abstand zu sticky Header/Footer — mehr Platz für große PIN-Tasten.
          "relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.4rem,1.4dvh,0.85rem)] px-4 py-[clamp(0.35rem,1.2dvh,0.75rem)]",
          className,
        )}
      >
        {showBrand ? (
          <div className="flex max-w-full flex-col items-center gap-1.5">
            <DisplayRestaurantLogo
              src={restaurantAvatarUrl}
              initials={displayRestaurantInitials(trimmedName || "?")}
              alt={trimmedName}
              size="lg"
              className={cn(
                displayRestaurantLogoPinClassName,
                !restaurantAvatarUrl && "text-sm font-semibold text-muted-foreground sm:text-base",
              )}
              imageClassName="!max-h-full !max-w-full p-0 object-contain"
            />
            {trimmedName ? (
              <p className="max-w-[min(20rem,90vw)] truncate text-center text-sm font-medium tracking-tight text-foreground/90 sm:text-base">
                {trimmedName}
              </p>
            ) : null}
          </div>
        ) : null}
        <DisplayPinStandbyClock />
        {children}
      </div>
    </div>
  );
}

/** @deprecated Alias — Hintergrund separat. */
export function DisplayPinScreensaverBackground({
  accentHex,
  className,
}: {
  accentHex: string;
  className?: string;
}) {
  return <DisplayPinStandbyBackground accentHex={accentHex} className={className} />;
}
