"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { Mail, MapPin, Phone } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { ProfileTabPanel, ProfileTabStack } from "@/components/public/profile-tab-panel";
import { PROFILE_TAB_ICONS } from "@/components/public/restaurant-public-profile-hero";
import { RestaurantPublicProfileModuleSkeleton } from "@/components/public/restaurant-public-profile-module-skeleton";
import { RestaurantPublicOpeningHours } from "@/components/public/restaurant-public-opening-hours";
import type { PublicEmbedMenu } from "@/lib/menu/public-menu-server";
import {
  preloadProfileWidgetChunks,
  scheduleProfileBackgroundWork,
} from "@/lib/public-profile/preload-profile-chunks";
import {
  profileSegmentSpring,
  profileTabContentVariants,
  profileTabItemVariants,
} from "@/lib/public-profile/profile-tab-transition";
import {
  useProfileModuleCache,
  type ProfileModuleKey,
} from "@/lib/public-profile/use-profile-module-cache";
import { publicCountries } from "@/lib/reservations/public-embed-shared";
import type { PublicEmbedRestaurant } from "@/lib/reservations/public-embed-shared";
import type { PublicEmbedReviews } from "@/lib/reviews/public-reviews-server";
import type { PublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";
import { cn } from "@/lib/utils";

const EmbedReservationWidget = dynamic(
  () =>
    import("@/components/embed/embed-reservation-widget").then(
      (mod) => mod.EmbedReservationWidget,
    ),
  { loading: () => <RestaurantPublicProfileModuleSkeleton /> },
);

const EmbedMenuWidget = dynamic(
  () =>
    import("@/components/embed/embed-menu-widget").then((mod) => mod.EmbedMenuWidget),
  { loading: () => <RestaurantPublicProfileModuleSkeleton /> },
);

const EmbedReviewsWidget = dynamic(
  () =>
    import("@/components/embed/embed-reviews-widget").then(
      (mod) => mod.EmbedReviewsWidget,
    ),
  { loading: () => <RestaurantPublicProfileModuleSkeleton /> },
);

type ProfileTab = "reserve" | "menu" | "reviews" | "info";

const TAB_META: { id: ProfileTab; label: string; module?: ProfileModuleKey }[] = [
  { id: "reserve", label: "Reservieren", module: "reservation" },
  { id: "menu", label: "Speisekarte", module: "menu" },
  { id: "reviews", label: "Bewertungen", module: "reviews" },
  { id: "info", label: "Info" },
];

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

function ModuleCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
      {children}
    </div>
  );
}

function ModulePanel({
  showLoading,
  error,
  children,
}: {
  showLoading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  if (showLoading) {
    return <RestaurantPublicProfileModuleSkeleton />;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
        Dieses Modul konnte gerade nicht geladen werden.
      </div>
    );
  }
  return <>{children}</>;
}

export function RestaurantPublicProfileTabs({
  profile,
}: {
  profile: PublicRestaurantProfile;
}) {
  const reduceMotion = useReducedMotion();
  const { cache, state, loadModule, preloadModules } = useProfileModuleCache(
    profile.slug,
  );
  const backgroundStarted = useRef(false);

  const availableTabs = useMemo(() => {
    return TAB_META.filter((tab) => {
      if (tab.id === "reserve") return profile.modules.reservation;
      if (tab.id === "menu") return profile.modules.menu;
      if (tab.id === "reviews") return profile.modules.reviews;
      return true;
    });
  }, [profile.modules]);

  const moduleTabs = useMemo(
    () =>
      availableTabs
        .map((tab) => TAB_META.find((m) => m.id === tab.id)?.module)
        .filter((m): m is ProfileModuleKey => Boolean(m)),
    [availableTabs],
  );

  const [activeTab, setActiveTab] = useState<ProfileTab>(
    () => availableTabs[0]?.id ?? "info",
  );
  const [direction, setDirection] = useState(1);
  const [mountedPanels, setMountedPanels] = useState<Set<ProfileTab>>(
    () => new Set([availableTabs[0]?.id ?? "info"]),
  );

  const handleTabChange = (tab: ProfileTab) => {
    const oldIdx = availableTabs.findIndex((t) => t.id === activeTab);
    const newIdx = availableTabs.findIndex((t) => t.id === tab);
    setDirection(newIdx >= oldIdx ? 1 : -1);
    setActiveTab(tab);
    setMountedPanels((prev) => new Set(prev).add(tab));
    const module = TAB_META.find((t) => t.id === tab)?.module;
    if (module && !cache[module]) {
      void loadModule(module);
    }
  };

  const startBackgroundPreload = useCallback(() => {
    if (backgroundStarted.current) return;
    backgroundStarted.current = true;

    preloadProfileWidgetChunks();
    void preloadModules(moduleTabs);
  }, [moduleTabs, preloadModules]);

  useEffect(() => {
    const module = TAB_META.find((t) => t.id === activeTab)?.module;
    if (module) void loadModule(module);
  }, [activeTab, loadModule]);

  useEffect(() => {
    setMountedPanels((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (cache.reservation) setMountedPanels((p) => new Set(p).add("reserve"));
    if (cache.menu) setMountedPanels((p) => new Set(p).add("menu"));
    if (cache.reviews) setMountedPanels((p) => new Set(p).add("reviews"));
  }, [cache.menu, cache.reservation, cache.reviews]);

  useEffect(() => {
    return scheduleProfileBackgroundWork(startBackgroundPreload);
  }, [startBackgroundPreload]);

  const addressLine = [
    profile.addressLine1,
    [profile.postalCode, profile.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  const reservation = cache.reservation as PublicEmbedRestaurant | null;
  const menu = cache.menu as PublicEmbedMenu | null;
  const reviews = cache.reviews as PublicEmbedReviews | null;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
      <LazyMotion features={domAnimation}>
        <nav
          className="sticky top-0 z-20 -mx-4 mt-6 px-4 pb-3 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6"
          aria-label="Profil-Bereiche"
        >
          <div className="flex gap-1 overflow-x-auto rounded-full border border-border/40 bg-muted/35 p-1 shadow-sm scrollbar-none">
            {availableTabs.map((tab) => {
              const Icon = PROFILE_TAB_ICONS[tab.id];
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  onPointerEnter={() => {
                    setMountedPanels((p) => new Set(p).add(tab.id));
                    const module = TAB_META.find((t) => t.id === tab.id)?.module;
                    if (module) void loadModule(module, { silent: true });
                  }}
                  className={cn(
                    "relative flex min-w-0 flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-medium transition-colors sm:px-4",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {active ? (
                    <m.span
                      layoutId="profile-segment-pill"
                      className="absolute inset-0 rounded-full bg-background shadow-card ring-1 ring-border/40"
                      transition={profileSegmentSpring}
                    />
                  ) : null}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </LazyMotion>

      <ProfileTabStack activeKey={activeTab} direction={direction} className="mt-6">
        {mountedPanels.has("info") ? (
          <ProfileTabPanel
            panelKey="info"
            active={activeTab === "info"}
            direction={direction}
          >
            <LazyMotion features={domAnimation}>
              <m.div
                variants={reduceMotion ? undefined : profileTabContentVariants}
                initial={reduceMotion ? false : "hidden"}
                animate={activeTab === "info" && !reduceMotion ? "visible" : undefined}
                className="space-y-4"
              >
                {addressLine ? (
                  <m.section
                    variants={reduceMotion ? undefined : profileTabItemVariants}
                    className="rounded-2xl border border-border/50 bg-card p-5 shadow-card"
                  >
                    <h2 className="text-sm font-semibold tracking-tight">Adresse</h2>
                    <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      {addressLine}
                    </p>
                  </m.section>
                ) : null}

                <m.section
                  variants={reduceMotion ? undefined : profileTabItemVariants}
                  className="rounded-2xl border border-border/50 bg-card p-5 shadow-card"
                >
                  <h2 className="text-sm font-semibold tracking-tight">Öffnungszeiten</h2>
                  <RestaurantPublicOpeningHours
                    weeklyHours={profile.weeklyHours}
                    className="mt-3"
                  />
                </m.section>

                {profile.socialLinks.length > 0 ? (
                  <m.section
                    variants={reduceMotion ? undefined : profileTabItemVariants}
                    className="rounded-2xl border border-border/50 bg-card p-5 shadow-card"
                  >
                    <h2 className="text-sm font-semibold tracking-tight">Kontakt</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.socialLinks.map((link) => (
                        <SocialLinkChip
                          key={`info-${link.kind}-${link.href}`}
                          link={link}
                        />
                      ))}
                    </div>
                  </m.section>
                ) : null}
              </m.div>
            </LazyMotion>
          </ProfileTabPanel>
        ) : null}

        {mountedPanels.has("reserve") && profile.modules.reservation ? (
          <ProfileTabPanel
            panelKey="reserve"
            active={activeTab === "reserve"}
            direction={direction}
          >
            <ModulePanel
              showLoading={!reservation && state.reservation.loading}
              error={state.reservation.error}
            >
              {reservation ? (
                <ModuleCard>
                  <EmbedReservationWidget
                    config={reservation}
                    countries={publicCountries()}
                  />
                </ModuleCard>
              ) : null}
            </ModulePanel>
          </ProfileTabPanel>
        ) : null}

        {mountedPanels.has("menu") && profile.modules.menu ? (
          <ProfileTabPanel
            panelKey="menu"
            active={activeTab === "menu"}
            direction={direction}
          >
            <ModulePanel
              showLoading={!menu && state.menu.loading}
              error={state.menu.error}
            >
              {menu ? (
                <ModuleCard>
                  <EmbedMenuWidget
                    restaurantName={menu.name}
                    accentHex={menu.accentHex}
                    categories={menu.categories}
                    items={menu.items}
                    tagDefinitions={menu.tagDefinitions}
                  />
                </ModuleCard>
              ) : null}
            </ModulePanel>
          </ProfileTabPanel>
        ) : null}

        {mountedPanels.has("reviews") && profile.modules.reviews ? (
          <ProfileTabPanel
            panelKey="reviews"
            active={activeTab === "reviews"}
            direction={direction}
          >
            <ModulePanel
              showLoading={!reviews && state.reviews.loading}
              error={state.reviews.error}
            >
              {reviews ? (
                <ModuleCard>
                  <EmbedReviewsWidget
                    restaurantName={reviews.name}
                    accentHex={reviews.accentHex}
                    reviews={reviews.reviews}
                    summary={reviews.summary}
                  />
                </ModuleCard>
              ) : null}
            </ModulePanel>
          </ProfileTabPanel>
        ) : null}
      </ProfileTabStack>
    </div>
  );
}
