"use client";

import type { ReactNode } from "react";
import { DisplayBrandMark } from "@/components/display/display-brand-mark";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Fußzeile: Restaurant + Display dezent, Gwada-Mark — ohne Cover/Header-Branding. */
export function DisplayContextFooter({
  restaurantName,
  restaurantAvatarUrl,
  displayName,
  showLogout = false,
  onLogout,
  todoBadge,
  className,
}: {
  restaurantName: string;
  restaurantAvatarUrl?: string | null;
  displayName?: string | null;
  showLogout?: boolean;
  onLogout?: () => void;
  /** Tappbare ToDo-Badge — z. B. `DisplayStaffTodoBadge`. */
  todoBadge?: ReactNode;
  className?: string;
}) {
  const initials = displayRestaurantInitials(restaurantName);
  const trimmedName = restaurantName.trim();
  const trimmedDisplay = displayName?.trim() ?? "";

  return (
    <footer
      className={cn(
        "relative shrink-0 border-t border-border/20 px-4 py-3",
        showLogout && "pr-[5.5rem] sm:pr-28",
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-center gap-1.5">
        {restaurantAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurantAvatarUrl}
            alt=""
            decoding="async"
            className="size-[18px] shrink-0 rounded-[5px] object-cover object-center"
          />
        ) : trimmedName ? (
          <span
            aria-hidden
            className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-muted/80 text-[8px] font-semibold leading-none text-muted-foreground"
          >
            {initials}
          </span>
        ) : null}

        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {trimmedName ? (
            <span className="font-medium text-foreground/75">{trimmedName}</span>
          ) : null}
          {trimmedDisplay ? (
            <>
              {trimmedName ? <span aria-hidden> · </span> : null}
              <span>{trimmedDisplay}</span>
            </>
          ) : null}
        </p>

        {todoBadge ? (
          <>
            <span aria-hidden className="shrink-0 text-border/50">
              ·
            </span>
            {todoBadge}
          </>
        ) : null}

        <span aria-hidden className="shrink-0 text-border/50">
          ·
        </span>
        <DisplayBrandMark size="sm" className="shrink-0" />
      </div>

      {showLogout && onLogout ? (
        <div className="absolute top-1/2 right-4 -translate-y-1/2 sm:right-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 rounded-xl px-3"
            onClick={onLogout}
          >
            Abmelden
          </Button>
        </div>
      ) : null}
    </footer>
  );
}
