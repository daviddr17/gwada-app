"use client";

import { RestaurantProfileBrandedCanvas } from "@/components/public/restaurant-profile-branded-canvas";
import type { BrandProfileBackdropIntensity } from "@/lib/public-profile/profile-branded-backdrop";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { normalizeHex } from "@/lib/theme/color-utils";
import { cn } from "@/lib/utils";

export function AppBrandedBackground({
  accentHex,
  intensity = "hint",
  className,
}: {
  accentHex: string;
  intensity?: BrandProfileBackdropIntensity;
  className?: string;
}) {
  const resolvedAccent = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <RestaurantProfileBrandedCanvas accentHex={resolvedAccent} intensity={intensity} />
    </div>
  );
}
