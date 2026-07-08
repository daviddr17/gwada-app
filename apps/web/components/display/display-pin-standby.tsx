"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { DisplayBrandedBackground } from "@/components/display/display-branded-background";
import { useDisplayRestaurantTimezone } from "@/components/display/display-restaurant-timezone-provider";
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
      <p className="text-[clamp(3.5rem,14vw,6.5rem)] font-extralight leading-none tracking-tight tabular-nums text-foreground">
        {timeLabel}
      </p>
      <p className="mt-3 text-lg font-medium capitalize text-foreground/85 sm:text-xl">
        {dateLabel}
      </p>
    </div>
  );
}

/** Profil-Mesh + Uhr für Display-PIN / Sperrbildschirm. */
export function DisplayPinStandbyScene({
  accentHex,
  enabled = true,
  className,
  children,
}: {
  accentHex: string;
  enabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      <DisplayPinStandbyBackground accentHex={accentHex} />
      <div
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 py-6",
          className,
        )}
      >
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
