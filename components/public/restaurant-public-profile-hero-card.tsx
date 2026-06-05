"use client";

import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { PublicProfileOpeningStatusChip } from "@/components/public/public-profile-opening-status-chip";
import { PublicProfileSocialChip } from "@/components/public/public-profile-social-chip";
import { PublicRestaurantImage } from "@/components/public/public-restaurant-image";
import { PublicProfileLogoCrossfade } from "@/components/public/public-profile-logo-crossfade";
import type { PublicProfileLogoIntro } from "@/components/public/public-profile-logo-crossfade";
import { RestaurantLogoMark } from "@/components/ui/restaurant-logo-mark";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import { formatPublicRestaurantAddress, publicRestaurantMapsUrl } from "@/lib/restaurant/public-maps-url";
import { getPublicOpeningStatus } from "@/lib/restaurant/public-opening-status";
import {
  publicProfileHeroBodyClassName,
  publicProfileHeroCardShellClassName,
  publicProfileHeroCoverClassName,
  publicProfileHeroDescriptionClassName,
  publicProfileHeroLogoRowClassName,
  publicProfileHeroDetailsBlockClassName,
  publicProfileHeroSectionClassName,
  publicProfileHeroSocialBlockClassName,
  publicProfileHeroStageClassName,
  publicProfileHeroStatusBlockClassName,
  publicProfileHeroTitleBlockClassName,
  publicProfileHeroTitleClassName,
} from "@/lib/ui/public-profile-hero-layout";
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

export function RestaurantPublicProfileHeroCard({
  profile,
  logoIntro,
}: {
  profile: PublicRestaurantProfile;
  logoIntro?: PublicProfileLogoIntro;
}) {
  const reduceMotion = useReducedMotion();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [parallaxReady, setParallaxReady] = useState(false);

  const sx = useSpring(mouse.x, { stiffness: 80, damping: 24, mass: 0.4 });
  const sy = useSpring(mouse.y, { stiffness: 80, damping: 24, mass: 0.4 });

  useEffect(() => {
    if (reduceMotion) return;
    const enable = () => setParallaxReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(enable, { timeout: 2200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(enable, 1200);
    return () => globalThis.clearTimeout(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !parallaxReady) return;
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [parallaxReady, reduceMotion]);

  useEffect(() => {
    sx.set(mouse.x);
    sy.set(mouse.y);
  }, [mouse.x, mouse.y, sx, sy]);

  const shiftX = useTransform(sx, [-1, 1], [10, -10]);
  const shiftY = useTransform(sy, [-1, 1], [8, -8]);
  const glareX = useTransform(sx, [-1, 1], [22, 78]);
  const glareY = useTransform(sy, [-1, 1], [18, 82]);
  const glare = useMotionTemplate`radial-gradient(120% 80% at ${glareX}% ${glareY}%, rgba(255,255,255,0.22) 0%, transparent 55%)`;

  const addressLine = formatPublicRestaurantAddress(profile);
  const mapsUrl = publicRestaurantMapsUrl(profile);
  const phone = profile.phone?.trim();
  const opening = getPublicOpeningStatus(
    profile.weeklyHours,
    profile.dateExceptions,
  );
  const initials = restaurantInitials(profile.name);
  const socialLinks = profile.socialLinks;

  const card = (
    <div className={publicProfileHeroCardShellClassName}>
      {!reduceMotion ? (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-70"
          style={{ background: glare }}
        />
      ) : null}

      <div className={publicProfileHeroCoverClassName}>
        {profile.coverUrl ? (
          <PublicRestaurantImage
            src={profile.coverUrl}
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
          {logoIntro ? (
            <PublicProfileLogoCrossfade
              gwadaIconSrc={logoIntro.gwadaIconSrc}
              restaurantAvatarUrl={profile.avatarUrl}
              restaurantName={profile.name}
              active={logoIntro.active}
              onComplete={logoIntro.onComplete}
              className="shrink-0"
            />
          ) : (
            <RestaurantLogoMark
              src={profile.avatarUrl}
              initials={initials}
              alt=""
              variant="profile"
              className="shrink-0"
            />
          )}
        </div>

        <div className={publicProfileHeroTitleBlockClassName}>
          <h1 className={publicProfileHeroTitleClassName}>
            {profile.name}
          </h1>
          {profile.description ? (
            <p className={publicProfileHeroDescriptionClassName}>
              {profile.description}
            </p>
          ) : null}
        </div>

        <div className={publicProfileHeroStatusBlockClassName}>
          <PublicProfileOpeningStatusChip opening={opening} />
        </div>

        {(addressLine || phone) ? (
          <div className={publicProfileHeroDetailsBlockClassName}>
            {addressLine ? (
              mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-center gap-2 text-center text-foreground/90 underline-offset-4 hover:underline"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 break-words">{addressLine}</span>
                </a>
              ) : (
                <p className="flex items-start justify-center gap-2 text-center text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 break-words">{addressLine}</span>
                </p>
              )
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="flex items-center justify-center gap-2 text-foreground/90 underline-offset-4 hover:underline"
              >
                <Phone className="size-4 shrink-0 text-accent" aria-hidden />
                {phone}
              </a>
            ) : null}
          </div>
        ) : null}

        {socialLinks.length > 0 ? (
          <div className={publicProfileHeroSocialBlockClassName}>
            {socialLinks.map((link) => (
              <PublicProfileSocialChip key={`${link.kind}-${link.href}`} link={link} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <section className={publicProfileHeroSectionClassName}>
      <div className={publicProfileHeroStageClassName}>
        <motion.div
          style={
            reduceMotion || !parallaxReady
              ? undefined
              : { x: shiftX, y: shiftY }
          }
          className="relative w-full"
        >
          {card}
        </motion.div>
      </div>
    </section>
  );
}
