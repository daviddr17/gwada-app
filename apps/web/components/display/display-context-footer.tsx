"use client";

import { DisplayBrandMark } from "@/components/display/display-brand-mark";
import { DisplayRestaurantLogo } from "@/components/display/display-restaurant-logo";
import { displayRestaurantInitials } from "@/lib/display/display-avatar-utils";
import { Button } from "@/components/ui/button";
import { displayChromeFooterClassName } from "@/lib/ui/display-chrome";
import { displayRestaurantLogoFooterClassName } from "@/lib/ui/display-restaurant-branding";
import { cn } from "@/lib/utils";

const displayFooterLogoutButtonClassName =
  "h-9 shrink-0 rounded-xl px-3 text-sm whitespace-nowrap";

const displayFooterScrollClassName =
  "flex min-w-0 flex-1 items-stretch overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Fußzeile: Restaurant links, Gwada Mitte, Gerät rechts, Abmelden sticky. */
export function DisplayContextFooter({
  restaurantName,
  restaurantAvatarUrl,
  displayName,
  showLogout = false,
  onLogout,
  className,
}: {
  restaurantName: string;
  restaurantAvatarUrl?: string | null;
  displayName?: string | null;
  showLogout?: boolean;
  onLogout?: () => void;
  className?: string;
}) {
  const initials = displayRestaurantInitials(restaurantName);
  const trimmedName = restaurantName.trim();
  const trimmedDisplay = displayName?.trim() ?? "";
  const logoutVisible = showLogout && Boolean(onLogout);
  const showRestaurantMark = Boolean(restaurantAvatarUrl) || Boolean(trimmedName);

  return (
    <footer
      className={cn(
        displayChromeFooterClassName,
        "relative flex min-h-11 items-stretch",
        className,
      )}
    >
      <div className={displayFooterScrollClassName}>
        <div className="flex min-w-max flex-1 items-center gap-3 py-2 pl-4 pr-3">
          <div className="flex shrink-0 items-center gap-2">
            {showRestaurantMark ? (
              <DisplayRestaurantLogo
                src={restaurantAvatarUrl}
                initials={initials}
                alt={trimmedName || ""}
                size="sm"
                className={cn(
                  displayRestaurantLogoFooterClassName,
                  !restaurantAvatarUrl && "text-[8px] font-semibold text-muted-foreground",
                )}
                imageClassName="!max-h-full !max-w-full p-0 object-contain"
              />
            ) : null}
            {trimmedName ? (
              <span className="whitespace-nowrap text-xs font-medium text-foreground/75">
                {trimmedName}
              </span>
            ) : null}
          </div>

          <div className="min-w-[5.5rem] flex-1 shrink-0" aria-hidden />

          <div className="flex shrink-0 items-center gap-2">
            {trimmedDisplay ? (
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {trimmedDisplay}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 z-[2] flex -translate-x-1/2 items-center"
        aria-hidden={false}
      >
        <DisplayBrandMark layout="footer" className="pointer-events-auto bg-background/95 px-1" />
      </div>

      {logoutVisible ? (
        <div className="sticky right-0 z-[3] flex shrink-0 items-center self-stretch border-l border-border/20 bg-background py-2 pr-4 pl-3 shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.12)] dark:shadow-[-10px_0_16px_-10px_rgba(0,0,0,0.45)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={displayFooterLogoutButtonClassName}
            onClick={onLogout}
          >
            Abmelden
          </Button>
        </div>
      ) : (
        <div className="shrink-0 pr-4" aria-hidden />
      )}
    </footer>
  );
}
