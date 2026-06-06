"use client";

import {
  Clock,
  Contact2,
  Mail,
  MapPin,
  Phone,
  Globe,
} from "lucide-react";
import {
  EmbedSlidingSegmentTabs,
  type EmbedSlidingSegmentTab,
} from "@/components/embed/embed-sliding-segment-tabs";
import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import { RestaurantPublicOpeningHours } from "@/components/public/restaurant-public-opening-hours";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import {
  profileContactChipClassName,
  profileContactChipGridClassName,
  profileContactSocialRowClassName,
} from "@/lib/ui/public-profile-contact-layout";
import { cn } from "@/lib/utils";

export type PublicProfileInfoTab = "contact" | "hours";

const INFO_TABS: readonly EmbedSlidingSegmentTab<PublicProfileInfoTab>[] = [
  { id: "contact", label: "Kontakt", icon: Contact2 },
  { id: "hours", label: "Öffnungszeiten", icon: Clock },
];

function ProfileContactChip({
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
      className={profileContactChipClassName}
    >
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 text-center leading-snug">{label}</span>
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

function PublicProfileContactPanel({
  profile,
  addressLine,
  mapsUrl,
}: {
  profile: PublicRestaurantProfile;
  addressLine: string;
  mapsUrl: string | null;
}) {
  const phone = profile.phone?.trim();
  const email = profile.email?.trim();
  const website = profile.website?.trim();
  const socialLinks = profile.socialLinks;
  const hasContactChips = Boolean(addressLine || phone || email || website);
  const hasContent = hasContactChips || socialLinks.length > 0;

  if (!hasContent) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Keine Kontaktdaten hinterlegt.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasContactChips ? (
        <div className={profileContactChipGridClassName}>
          {addressLine ? (
            mapsUrl ? (
              <ProfileContactChip
                href={mapsUrl}
                icon={<MapPin className="size-4" aria-hidden />}
                label={addressLine}
                external
              />
            ) : (
              <div
                className={cn(
                  profileContactChipClassName,
                  "text-muted-foreground hover:border-border/40 hover:bg-background/60",
                )}
              >
                <MapPin className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 text-center leading-snug">{addressLine}</span>
              </div>
            )
          ) : null}

          {phone ? (
            <ProfileContactChip
              href={`tel:${phone.replace(/\s+/g, "")}`}
              icon={<Phone className="size-4" aria-hidden />}
              label={phone}
            />
          ) : null}

          {email ? (
            <ProfileContactChip
              href={`mailto:${email}`}
              icon={<Mail className="size-4" aria-hidden />}
              label={email}
            />
          ) : null}

          {website ? (
            <ProfileContactChip
              href={website}
              icon={<Globe className="size-4" aria-hidden />}
              label={formatWebsiteLabel(website)}
              external
            />
          ) : null}
        </div>
      ) : null}

      {socialLinks.length > 0 ? (
        <div
          className={cn(
            profileContactSocialRowClassName,
            !hasContactChips && "border-t-0 pt-0",
          )}
        >
          {socialLinks.map((link) => (
            <PublicProfileSocialChip
              key={`info-${link.kind}-${link.href}`}
              link={link}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PublicProfileInfoSections({
  profile,
  addressLine,
  mapsUrl,
  tab,
  onTabChange,
  className,
  sectionClassName = "rounded-2xl border border-border/50 bg-card/80 p-4 shadow-card backdrop-blur-sm",
}: {
  profile: PublicRestaurantProfile;
  addressLine: string;
  mapsUrl: string | null;
  tab: PublicProfileInfoTab;
  onTabChange: (tab: PublicProfileInfoTab) => void;
  className?: string;
  sectionClassName?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <EmbedSlidingSegmentTabs
        tabs={INFO_TABS}
        value={tab}
        onChange={onTabChange}
        aria-label="Restaurant-Info"
      />

      <div className={sectionClassName}>
        {tab === "contact" ? (
          <PublicProfileContactPanel
            profile={profile}
            addressLine={addressLine}
            mapsUrl={mapsUrl}
          />
        ) : (
          <RestaurantPublicOpeningHours weeklyHours={profile.weeklyHours} />
        )}
      </div>
    </div>
  );
}
