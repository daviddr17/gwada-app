import type { ReactNode } from "react";
import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { restaurantLogoMarkSizeClasses } from "@/components/ui/restaurant-logo-mark";
import { formatPublicRestaurantAddress } from "@/lib/restaurant/public-maps-url";
import { PublicProfileOpeningStatusChip } from "@/components/public/public-profile-opening-status-chip";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import { getPublicOpeningStatus } from "@/lib/restaurant/public-opening-status";
import {
  publicProfileHeroBodyClassName,
  publicProfileHeroBodyFallbackMinClassName,
  publicProfileHeroCardShellClassName,
  publicProfileHeroCardSkeletonShellClassName,
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
import { cn } from "@/lib/utils";

function LinePlaceholder({
  showShimmer,
  className,
}: {
  showShimmer: boolean;
  className?: string;
}) {
  if (showShimmer) {
    return <Skeleton className={className} />;
  }
  return (
    <div
      className={cn("rounded-xl bg-muted/35", className)}
      aria-hidden
    />
  );
}

/** Unsichtbarer Spiegel für exakte Höhe, Shimmer absolut darüber. */
function MirroredSkeletonBlock({
  mirror,
  showShimmer,
  shimmerClassName,
}: {
  mirror: ReactNode;
  showShimmer: boolean;
  shimmerClassName?: string;
}) {
  return (
    <div className="relative isolate">
      <div className="invisible select-none" aria-hidden>
        {mirror}
      </div>
      <div className="absolute inset-0 z-[1]">
        <LinePlaceholder
          showShimmer={showShimmer}
          className={cn("size-full", shimmerClassName)}
        />
      </div>
    </div>
  );
}

function openingStatusMirror(profile: PublicRestaurantProfile) {
  return getPublicOpeningStatus(profile.weeklyHours, profile.dateExceptions);
}

/** Platzhalter — gleiche Karten-Chrome und Inhaltshöhe wie Live-Hero. */
export function RestaurantPublicProfileLauncherSkeleton({
  profile,
  showShimmer = true,
  showDockPlaceholder = true,
  transparentBody = false,
  className,
}: {
  profile?: PublicRestaurantProfile;
  showShimmer?: boolean;
  showDockPlaceholder?: boolean;
  /** Kein weißer Karten-Hintergrund — Hero-Inhalt scheint durch. */
  transparentBody?: boolean;
  className?: string;
}) {
  const addressLine = profile
    ? formatPublicRestaurantAddress(profile)
    : null;
  const phone = profile?.phone?.trim() || null;
  const hasDetails = Boolean(addressLine || phone);
  const socialLinks = profile?.socialLinks ?? [];

  return (
    <div
      className={cn("relative flex h-dvh flex-col overflow-hidden", className)}
      aria-busy="true"
      aria-label="Profil wird geladen"
    >
      <section className={publicProfileHeroSectionClassName}>
        <div className={publicProfileHeroStageClassName}>
          <div
            className={
              transparentBody
                ? publicProfileHeroCardSkeletonShellClassName
                : publicProfileHeroCardShellClassName
            }
          >
            {transparentBody ? (
              <div
                className={publicProfileHeroCoverClassName}
                aria-hidden
              />
            ) : (
              <div className={publicProfileHeroCoverClassName}>
                <LinePlaceholder
                  showShimmer={showShimmer}
                  className="block h-full w-full rounded-none"
                />
              </div>
            )}

            <div
              className={cn(
                publicProfileHeroBodyClassName,
                !profile && publicProfileHeroBodyFallbackMinClassName,
              )}
            >
              {transparentBody ? (
                <div className={publicProfileHeroLogoRowClassName}>
                  <span
                    className={cn(
                      restaurantLogoMarkSizeClasses.profile,
                      "invisible inline-flex shrink-0 rounded-full",
                    )}
                    aria-hidden
                  />
                </div>
              ) : (
                <div className={publicProfileHeroLogoRowClassName}>
                  <LinePlaceholder
                    showShimmer={showShimmer}
                    className="size-20 rounded-full sm:size-24 md:size-28 lg:size-32"
                  />
                </div>
              )}

              <div className={publicProfileHeroTitleBlockClassName}>
                {profile ? (
                  <MirroredSkeletonBlock
                    showShimmer={showShimmer}
                    mirror={
                      <h1 className={publicProfileHeroTitleClassName}>
                        {profile.name}
                      </h1>
                    }
                  />
                ) : (
                  <LinePlaceholder
                    showShimmer={showShimmer}
                    className="mx-auto h-8 w-44 md:h-9 md:w-52 lg:h-10"
                  />
                )}

                {profile?.description?.trim() ? (
                  <MirroredSkeletonBlock
                    showShimmer={showShimmer}
                    mirror={
                      <p className={publicProfileHeroDescriptionClassName}>
                        {profile.description}
                      </p>
                    }
                  />
                ) : null}
              </div>

              <div className={publicProfileHeroStatusBlockClassName}>
                {profile ? (
                  <MirroredSkeletonBlock
                    showShimmer={showShimmer}
                    shimmerClassName="rounded-full"
                    mirror={
                      <PublicProfileOpeningStatusChip
                        opening={openingStatusMirror(profile)}
                      />
                    }
                  />
                ) : (
                  <LinePlaceholder
                    showShimmer={showShimmer}
                    className="h-7 w-36 rounded-full"
                  />
                )}
              </div>

              {hasDetails ? (
                <div className={publicProfileHeroDetailsBlockClassName}>
                  {addressLine ? (
                    <MirroredSkeletonBlock
                      showShimmer={showShimmer}
                      mirror={
                        <p className="flex items-start justify-center gap-2 text-center text-sm">
                          <span className="mt-0.5 size-4 shrink-0" aria-hidden />
                          <span className="min-w-0 break-words">{addressLine}</span>
                        </p>
                      }
                    />
                  ) : null}
                  {phone ? (
                    <MirroredSkeletonBlock
                      showShimmer={showShimmer}
                      mirror={
                        <p className="flex items-center justify-center gap-2 text-center text-sm">
                          <span className="size-4 shrink-0" aria-hidden />
                          {phone}
                        </p>
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              {socialLinks.length > 0 ? (
                <div className={publicProfileHeroSocialBlockClassName}>
                  {socialLinks.map((link) => (
                    <MirroredSkeletonBlock
                      key={`${link.kind}-${link.href}`}
                      showShimmer={showShimmer}
                      shimmerClassName="rounded-full"
                      mirror={<PublicProfileSocialChip link={link} />}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {showDockPlaceholder ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex justify-center px-4">
          <LinePlaceholder
            showShimmer={showShimmer}
            className="h-[3.75rem] w-[min(100%,18rem)] rounded-full"
          />
        </div>
      ) : null}
    </div>
  );
}
