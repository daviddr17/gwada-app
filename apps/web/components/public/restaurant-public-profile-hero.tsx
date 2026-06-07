import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import { RestaurantLogoMark } from "@/components/ui/restaurant-logo-mark";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";

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

/** Profil-Header (Avatar, Name, Socials) — Cover separat als Client-Komponente. */
export function RestaurantPublicProfileHero({
  profile,
}: {
  profile: PublicRestaurantProfile;
}) {
  const initials = restaurantInitials(profile.name);
  const socialLinks = profile.socialLinks;

  return (
    <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="landing-hero-rise-logo relative -mt-14 sm:-mt-16">
          <RestaurantLogoMark
            src={profile.avatarUrl}
            initials={initials}
            alt=""
            size="header"
            variant="header"
            className="shadow-lg ring-[5px] ring-background"
          />
        </div>

        <header className="landing-hero-rise-h1 mt-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {profile.name}
              </h1>
              {profile.description ? (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {profile.description}
                </p>
              ) : null}
            </div>
          </div>

          {socialLinks.length > 0 ? (
            <div className="landing-hero-rise-sub -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
              {socialLinks.map((link) => (
                <PublicProfileSocialChip key={`${link.kind}-${link.href}`} link={link} />
              ))}
            </div>
          ) : null}
        </header>
      </div>
  );
}
