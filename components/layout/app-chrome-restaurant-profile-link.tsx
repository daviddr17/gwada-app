"use client";

import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { isRestaurantAppZone } from "@/lib/navigation/app-zone-navigation";
import { publicRestaurantProfilePath } from "@/lib/restaurant/public-restaurant-url";
import { normalizeRestaurantSlugInput } from "@/lib/restaurant/restaurant-slug";

export function AppChromeRestaurantProfileLink() {
  const pathname = usePathname();
  const { profile, isReady } = useRestaurantProfile();

  const rawSlug = profile.slug.trim();
  const slug = rawSlug ? normalizeRestaurantSlugInput(rawSlug) : "";

  if (!isRestaurantAppZone(pathname) || !isReady || !slug) {
    return null;
  }

  const href = publicRestaurantProfilePath(slug);
  const restaurantName = profile.name.trim();

  return (
    <Button
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-full border-border/60"
      aria-label={
        restaurantName
          ? `${restaurantName} — öffentliches Profil in neuem Tab öffnen`
          : "Öffentliches Restaurant-Profil in neuem Tab öffnen"
      }
      nativeButton={false}
      render={
        <a href={href} target="_blank" rel="noopener noreferrer" />
      }
    >
      <ExternalLink className="size-4" />
    </Button>
  );
}
