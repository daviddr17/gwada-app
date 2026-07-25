import { MapPin, Phone } from "lucide-react";
import { PublicRestaurantImage } from "@/components/public/public-restaurant-image";
import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import {
  restaurantLogoHeaderFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoInnerTileClassName,
  restaurantLogoOuterPaddingClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
import {
  publicProfileHeroBodyClassName,
  publicProfileHeroCardShellClassName,
  publicProfileHeroCoverClassName,
  publicProfileHeroDescriptionClassName,
  publicProfileHeroDetailsBlockClassName,
  publicProfileHeroLogoRowClassName,
  publicProfileHeroSectionClassName,
  publicProfileHeroSocialBlockClassName,
  publicProfileHeroStageClassName,
  publicProfileHeroStatusBlockClassName,
  publicProfileHeroTitleBlockClassName,
  publicProfileHeroTitleClassName,
} from "@/lib/ui/public-profile-hero-layout";
import { brandedProfileBackdropStyle } from "@/lib/public-profile/profile-branded-backdrop";
import {
  formatPublicRestaurantAddress,
  publicRestaurantMapsUrl,
} from "@/lib/restaurant/public-maps-url";
import { getPublicOpeningStatus } from "@/lib/restaurant/public-opening-status";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import {
  PUBLIC_PROFILE_AVATAR_SIZES,
  PUBLIC_PROFILE_COVER_SIZES,
} from "@/lib/restaurant/public-profile-image-url";
import { cn } from "@/lib/utils";

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

const openingStatusChipClassName = {
  open: "border-emerald-500/40 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100",
  opens_later:
    "border-amber-500/50 bg-amber-500/16 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/14 dark:text-amber-50",
  closed:
    "border-border/60 bg-muted/40 text-foreground/90 dark:text-foreground/85",
} as const;

const openingStatusDotClassName = {
  open: "bg-emerald-500",
  opens_later: "bg-amber-500 dark:bg-amber-400",
  closed: "bg-muted-foreground/55",
} as const;

/**
 * Server-HTML Hero — Cover/Titel/Logo im ersten Response (LCP).
 * Interaktivität (Parallax, Mehr, Sheet) kommt später über den Client-Launcher.
 */
export function RestaurantPublicProfileHeroChrome({
  profile,
  showBackdrop = true,
}: {
  profile: PublicRestaurantProfile;
  showBackdrop?: boolean;
}) {
  const addressLine = formatPublicRestaurantAddress(profile);
  const mapsUrl = publicRestaurantMapsUrl(profile);
  const phone = profile.phone?.trim();
  const opening = getPublicOpeningStatus(
    profile.weeklyHours,
    profile.dateExceptions,
  );
  const initials = restaurantInitials(profile.name);
  const socialLinks = profile.socialLinks;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {showBackdrop ? (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={brandedProfileBackdropStyle(profile.accentHex)}
          aria-hidden
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-32 bg-gradient-to-b from-transparent to-background"
        aria-hidden
      />

      <section className={publicProfileHeroSectionClassName}>
        <div className={publicProfileHeroStageClassName}>
          <div className={publicProfileHeroCardShellClassName}>
            <div className={publicProfileHeroCoverClassName}>
              {profile.coverUrl ? (
                <PublicRestaurantImage
                  src={profile.coverUrl}
                  srcSet={profile.coverSrcSet}
                  sizes={PUBLIC_PROFILE_COVER_SIZES}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${profile.accentHex} 35%, #f4f6fd) 0%, color-mix(in srgb, ${profile.accentHex} 18%, white) 100%)`,
                  }}
                />
              )}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/90 via-white/20 to-transparent dark:from-black/80 dark:via-black/20"
                aria-hidden
              />
            </div>

            <div className={publicProfileHeroBodyClassName}>
              <div className={publicProfileHeroLogoRowClassName}>
                <span
                  className={cn(
                    restaurantLogoHeaderFrameClassName,
                    restaurantLogoPlateClassName,
                    restaurantLogoOuterPaddingClassName,
                    "size-20 shrink-0 text-xl shadow-lg ring-[4px] ring-white/90 dark:ring-background sm:size-24 sm:text-2xl md:size-28 md:text-3xl lg:size-32",
                    !profile.avatarUrl && "font-semibold text-muted-foreground",
                  )}
                >
                  <span className={restaurantLogoInnerTileClassName}>
                    {profile.avatarUrl ? (
                      <PublicRestaurantImage
                        src={profile.avatarUrl}
                        srcSet={profile.avatarSrcSet}
                        sizes={PUBLIC_PROFILE_AVATAR_SIZES}
                        alt=""
                        width={128}
                        height={128}
                        priority={!profile.coverUrl}
                        className={restaurantLogoImageClassName}
                      />
                    ) : (
                      initials
                    )}
                  </span>
                </span>
              </div>

              <div className={publicProfileHeroTitleBlockClassName}>
                <h1 className={publicProfileHeroTitleClassName}>
                  {profile.name}
                </h1>
                {profile.description ? (
                  <p
                    className={cn(
                      publicProfileHeroDescriptionClassName,
                      "line-clamp-2 whitespace-pre-wrap",
                    )}
                  >
                    {profile.description}
                  </p>
                ) : null}
              </div>

              <div className={publicProfileHeroStatusBlockClassName}>
                <span
                  className={cn(
                    "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                    openingStatusChipClassName[opening.state],
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      openingStatusDotClassName[opening.state],
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">{opening.label}</span>
                  {opening.detail ? (
                    <span className="shrink-0 font-normal opacity-90">
                      · {opening.detail}
                    </span>
                  ) : null}
                </span>
              </div>

              {addressLine || phone ? (
                <div className={publicProfileHeroDetailsBlockClassName}>
                  {addressLine ? (
                    mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start justify-center gap-2 text-center text-foreground/90 underline-offset-4 hover:underline"
                      >
                        <MapPin
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden
                        />
                        <span className="min-w-0 break-words">{addressLine}</span>
                      </a>
                    ) : (
                      <p className="flex items-start justify-center gap-2 text-center text-muted-foreground">
                        <MapPin
                          className="mt-0.5 size-4 shrink-0 text-accent"
                          aria-hidden
                        />
                        <span className="min-w-0 break-words">{addressLine}</span>
                      </p>
                    )
                  ) : null}
                  {phone ? (
                    <a
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="flex items-center justify-center gap-2 text-foreground/90 underline-offset-4 hover:underline"
                    >
                      <Phone
                        className="size-4 shrink-0 text-accent"
                        aria-hidden
                      />
                      {phone}
                    </a>
                  ) : null}
                </div>
              ) : null}

              {socialLinks.length > 0 ? (
                <div className={publicProfileHeroSocialBlockClassName}>
                  {socialLinks.map((link) => (
                    <PublicProfileSocialChip
                      key={`${link.kind}-${link.href}`}
                      link={link}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
