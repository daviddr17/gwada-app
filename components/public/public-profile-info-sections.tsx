"use client";

import {
  Mail,
  MapPin,
  Phone,
  Globe,
} from "lucide-react";
import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import { RestaurantPublicOpeningHours } from "@/components/public/restaurant-public-opening-hours";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import { cn } from "@/lib/utils";

function ProfileContactLink({
  href,
  icon,
  label,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 text-sm transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 break-words">{label}</span>
    </a>
  );
}

function formatWebsiteLabel(url: string): string {
  try {
    const host = new URL(url).host.replace(/^www\./, "");
    return host || url;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

export function PublicProfileInfoSections({
  profile,
  addressLine,
  mapsUrl,
  className,
  sectionClassName = "rounded-2xl border border-border/50 bg-card/80 p-4 shadow-card backdrop-blur-sm",
}: {
  profile: PublicRestaurantProfile;
  addressLine: string;
  mapsUrl: string | null;
  className?: string;
  sectionClassName?: string;
}) {
  const phone = profile.phone?.trim();
  const email = profile.email?.trim();
  const website = profile.website?.trim();
  const hasAddress = Boolean(addressLine);
  const hasContact = Boolean(phone || email || website);
  const socialLinks = profile.socialLinks;

  return (
    <div className={cn("space-y-4", className)}>
      {hasAddress ? (
        <section className={sectionClassName}>
          <h2 className="text-sm font-semibold tracking-tight">Adresse</h2>
          <div className="mt-3">
            {mapsUrl ? (
              <ProfileContactLink
                href={mapsUrl}
                icon={<MapPin className="size-4" aria-hidden />}
                label={addressLine}
                external
              />
            ) : (
              <div className="flex items-start gap-2.5 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 break-words">{addressLine}</span>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {hasContact ? (
        <section className={sectionClassName}>
          <h2 className="text-sm font-semibold tracking-tight">Kontakt</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {phone ? (
              <ProfileContactLink
                href={`tel:${phone.replace(/\s+/g, "")}`}
                icon={<Phone className="size-4" aria-hidden />}
                label={phone}
              />
            ) : null}
            {email ? (
              <ProfileContactLink
                href={`mailto:${email}`}
                icon={<Mail className="size-4" aria-hidden />}
                label={email}
              />
            ) : null}
            {website ? (
              <ProfileContactLink
                href={website}
                icon={<Globe className="size-4" aria-hidden />}
                label={formatWebsiteLabel(website)}
                external
              />
            ) : null}
          </div>
        </section>
      ) : null}

      <section className={sectionClassName}>
        <h2 className="text-sm font-semibold tracking-tight">Öffnungszeiten</h2>
        <RestaurantPublicOpeningHours
          weeklyHours={profile.weeklyHours}
          className="mt-3"
        />
      </section>

      {socialLinks.length > 0 ? (
        <section className={sectionClassName}>
          <h2 className="text-sm font-semibold tracking-tight">Social Media</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {socialLinks.map((link) => (
              <PublicProfileSocialChip
                key={`info-${link.kind}-${link.href}`}
                link={link}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
