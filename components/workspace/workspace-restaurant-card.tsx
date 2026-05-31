"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MyRestaurantRow } from "@/lib/hooks/use-my-restaurants";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getAccentForeground, normalizeHex } from "@/lib/theme/color-utils";
import {
  restaurantLogoHeaderFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import { cn } from "@/lib/utils";

/** Shell für Restaurant-Karten in „Meine Restaurants“. */
export const workspaceRestaurantCardClassName =
  "overflow-hidden rounded-xl border border-border/50 bg-card shadow-card";

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  const single = name.trim().slice(0, 2).toLocaleUpperCase("de-DE");
  return single || "?";
}

type WorkspaceRestaurantCardProps = {
  row: MyRestaurantRow;
  isActive: boolean;
  activeBusy: boolean;
  onSetActive: () => void;
};

export function WorkspaceRestaurantCard({
  row,
  isActive,
  activeBusy,
  onSetActive,
}: WorkspaceRestaurantCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  const brandHex = useMemo(
    () => normalizeHex(row.brandAccentHex ?? ""),
    [row.brandAccentHex],
  );
  const initials = useMemo(() => restaurantInitials(row.name), [row.name]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!row.avatarStoragePath) {
        if (!cancelled) setAvatarUrl(null);
        return;
      }
      const url = await resolveRestaurantProfileImageSignedUrl(
        createSupabaseBrowserClient(),
        row.avatarStoragePath,
      );
      if (!cancelled) setAvatarUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [row.avatarStoragePath]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!row.coverStoragePath) {
        if (!cancelled) setCoverUrl(null);
        return;
      }
      const url = await resolveRestaurantProfileImageSignedUrl(
        createSupabaseBrowserClient(),
        row.coverStoragePath,
      );
      if (!cancelled) setCoverUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [row.coverStoragePath]);

  const coverStyle = brandHex
    ? {
        background: `linear-gradient(135deg, ${brandHex}40 0%, ${brandHex}18 50%, var(--muted) 100%)`,
      }
    : undefined;

  const activeBadgeStyle = brandHex
    ? {
        backgroundColor: brandHex,
        color: getAccentForeground(brandHex),
        borderColor: "transparent",
      }
    : undefined;

  const avatarRingStyle = brandHex
    ? { boxShadow: `0 0 0 2px ${brandHex}` }
    : undefined;

  return (
    <article className={workspaceRestaurantCardClassName}>
      <div
        className="relative h-28 w-full overflow-hidden bg-muted/40 sm:h-32"
        style={coverUrl ? undefined : coverStyle}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="size-full object-cover" />
        ) : null}
        {brandHex ? (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1"
            style={{ backgroundColor: brandHex }}
            aria-hidden
          />
        ) : null}
      </div>

      <div className="relative px-4 pb-4 pt-0">
        <div
          className={cn(
            restaurantLogoHeaderFrameClassName,
            restaurantLogoPlateClassName,
            "relative -mt-10 mb-3 size-20",
          )}
          style={avatarRingStyle}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className={restaurantLogoImageClassName}
            />
          ) : (
            <span
              className="text-xl font-semibold text-muted-foreground"
              style={brandHex ? { color: brandHex } : undefined}
            >
              {initials}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-0.5">
            <h2 className="truncate text-lg font-semibold leading-tight">
              {row.name}
            </h2>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.slug}
            </p>
          </div>
          <Badge
            variant={isActive ? "default" : "outline"}
            className="shrink-0 font-normal"
            style={isActive ? activeBadgeStyle : undefined}
          >
            {isActive ? "Aktiv" : "Inaktiv"}
          </Badge>
        </div>

        {!isActive ? (
          <div className="mt-4 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={activeBusy}
              onClick={onSetActive}
            >
              Als aktiv setzen
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
