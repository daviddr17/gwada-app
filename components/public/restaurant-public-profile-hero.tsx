import { PublicRestaurantImage } from "@/components/public/public-restaurant-image";
import {
  Mail,
  Phone,
} from "lucide-react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import {
  restaurantLogoHeaderFrameClassName,
  restaurantLogoImageClassName,
  restaurantLogoPlateClassName,
} from "@/lib/ui/profile-avatar-image";
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

function SocialLinkChip({
  link,
}: {
  link: PublicRestaurantProfile["socialLinks"][number];
}) {
  const icon =
    link.kind === "facebook" ? (
      <FacebookGlyph className="size-4" />
    ) : link.kind === "instagram" ? (
      <InstagramGlyph className="size-4" />
    ) : link.kind === "google" ? (
      <GoogleGlyph className="size-4" />
    ) : link.kind === "phone" ? (
      <Phone className="size-4" aria-hidden />
    ) : (
      <Mail className="size-4" aria-hidden />
    );

  return (
    <a
      href={link.href}
      target={link.kind === "phone" || link.kind === "email" ? undefined : "_blank"}
      rel={
        link.kind === "phone" || link.kind === "email"
          ? undefined
          : "noopener noreferrer"
      }
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm font-medium shadow-sm backdrop-blur-md transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      {icon}
      <span className="max-w-[10rem] truncate">{link.label}</span>
    </a>
  );
}

/** Profil-Header (Avatar, Name, Socials) — Cover separat als Client-Komponente. */
export function RestaurantPublicProfileHero({
  profile,
}: {
  profile: PublicRestaurantProfile;
}) {
  const initials = restaurantInitials(profile.name);

  return (
    <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        <div className="landing-hero-rise-logo relative -mt-14 sm:-mt-16">
          <div
            className={cn(
              restaurantLogoHeaderFrameClassName,
              restaurantLogoPlateClassName,
              "size-24 shadow-lg ring-[5px] ring-background sm:size-28",
            )}
          >
            {profile.avatarUrl ? (
              <PublicRestaurantImage
                src={profile.avatarUrl}
                alt=""
                width={112}
                height={112}
                priority={!profile.coverUrl}
                className={restaurantLogoImageClassName}
              />
            ) : (
              <span className="text-2xl font-semibold text-muted-foreground sm:text-3xl">
                {initials}
              </span>
            )}
          </div>
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

          {profile.socialLinks.length > 0 ? (
            <div className="landing-hero-rise-sub -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
              {profile.socialLinks.map((link) => (
                <SocialLinkChip key={`${link.kind}-${link.href}`} link={link} />
              ))}
            </div>
          ) : null}
        </header>
      </div>
  );
}
