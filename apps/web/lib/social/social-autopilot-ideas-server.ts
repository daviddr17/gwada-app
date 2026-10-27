import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import { isUpcomingEmbedEvent } from "@/lib/events/events-embed-upcoming";
import { listPublicHolidaysInRange } from "@/lib/holidays/public-holidays-server";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import {
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
} from "@/lib/social/social-autopilot-bounds";
import {
  filterRelevantHolidays,
  isEventRelevantSoon,
  rotateBySeed,
  SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS,
} from "@/lib/social/social-autopilot-relevance";
import {
  autopilotWeeklyRoom,
  collectSocialAutopilotUsedKeys,
} from "@/lib/social/social-autopilot-dedupe";
import {
  socialAutopilotIdeaId,
  sourceBucketForSlot,
  type SocialAutopilotIdea,
} from "@/lib/social/social-autopilot-ideas";
import { pitchAutopilotIdeasWithLlm } from "@/lib/social/social-autopilot-ideas-llm";
import {
  applyIdeaPitchesToCatalog,
  heuristicIdeaPitch,
} from "@/lib/social/social-autopilot-ideas-pitch";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import {
  ensureSocialUploadTaskInDb,
  listSocialSuggestionsFromDb,
  pruneStaleHolidaySocialSuggestionsInDb,
  skipPendingSocialSuggestionsInDb,
} from "@/lib/social/social-suggestions-db";
import { insertRestaurantAiUsageEvent } from "@/lib/supabase/restaurant-ai-usage-db";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

/** Mehr Auswahl als Wochenziel — User pickt, was erstellt wird. */
export const SOCIAL_AUTOPILOT_MAX_IDEAS_SHOWN = 12;

type RestaurantRow = {
  id: string;
  name: string | null;
  country: string | null;
  avatar_storage_path: string | null;
  cover_storage_path: string | null;
};

export type SocialAutopilotCatalogIdea = SocialAutopilotIdea & {
  asset: SocialSuggestionAsset;
  dishDescription?: string;
  eventStartAt?: string;
  holidayDate?: string;
  holidayName?: string;
};

export type SocialAutopilotIdeasResult = {
  ideas: SocialAutopilotIdea[];
  /** Interne Katalog-Ideen inkl. Asset — für Generate. */
  catalog: SocialAutopilotCatalogIdea[];
  aiConfigured: boolean;
  aiProvider?: "openai" | "grok";
  skippedReason?: string;
  tasksCreated: boolean;
  maxSelect: number;
  pendingOpen: number;
  /** Wie viele offene Drafts beim Force-Refresh verworfen wurden. */
  forceSkipped?: number;
  /** true wenn Restaurant-KI Thema/Richtung geliefert hat. */
  ideasAiEnriched?: boolean;
  ideasLlmCalls?: number;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

async function loadRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantRow | null> {
  const { data, error } = await sb
    .from("restaurants")
    .select("id, name, country, avatar_storage_path, cover_storage_path")
    .eq("id", restaurantId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RestaurantRow;
}

async function loadMenuDishes(sb: SupabaseClient, restaurantId: string) {
  const { data, error } = await sb
    .from("menu_items")
    .select("id, name, description, image_url, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("is_active", true)
    .order("list_number", { ascending: true, nullsFirst: false })
    .limit(80);
  if (error || !data) return [];
  return data
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim(),
      description: String(row.description ?? "").trim(),
      imageUrl: String(row.image_url ?? "").trim(),
    }))
    .filter((d) => d.name && d.imageUrl);
}

async function loadGalleryAssets(sb: SupabaseClient, restaurantId: string) {
  const { data, error } = await sb
    .from("gwada_gallery_items")
    .select("id, storage_path, thumb_storage_path, caption, is_pinned")
    .eq("restaurant_id", restaurantId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(40);
  if (error || !data) return [];
  const out: Array<{
    id: string;
    storagePath: string;
    label: string;
    imageUrl: string;
  }> = [];
  for (const row of data) {
    const storagePath = String(
      row.thumb_storage_path || row.storage_path || "",
    ).trim();
    if (!storagePath) continue;
    const imageUrl = await resolveGalleryMediaSignedUrl(storagePath, 7200);
    if (!imageUrl) continue;
    out.push({
      id: String(row.id),
      storagePath: String(row.storage_path || storagePath),
      label: String(row.caption ?? "").trim() || "Galerie",
      imageUrl,
    });
  }
  return out;
}

async function loadUpcomingEvents(sb: SupabaseClient, restaurantId: string) {
  const { data, error } = await sb
    .from("gwada_events")
    .select("id, title, start_at, cover_storage_path, status")
    .eq("restaurant_id", restaurantId)
    .in("status", ["published", "scheduled", "draft"])
    .order("start_at", { ascending: true })
    .limit(20);
  if (error || !data) return [];
  const out: Array<{
    id: string;
    title: string;
    startAt: string;
    coverUrl: string;
    coverStoragePath: string | null;
  }> = [];
  for (const row of data) {
    const startAt = String(row.start_at ?? "");
    if (!startAt || !isUpcomingEmbedEvent({ startAt })) continue;
    const coverPath =
      typeof row.cover_storage_path === "string"
        ? row.cover_storage_path.trim()
        : "";
    if (!coverPath) continue;
    const coverUrl = await resolveEventsCoverSignedUrl(coverPath);
    if (!coverUrl) continue;
    out.push({
      id: String(row.id),
      title: String(row.title ?? "").trim() || "Event",
      startAt,
      coverUrl,
      coverStoragePath: coverPath,
    });
  }
  return out;
}

async function resolveProfileAsset(
  sb: SupabaseClient,
  restaurant: RestaurantRow,
  kind: "cover" | "avatar",
): Promise<SocialSuggestionAsset | null> {
  const path =
    kind === "cover"
      ? restaurant.cover_storage_path?.trim()
      : restaurant.avatar_storage_path?.trim();
  if (!path) return null;
  const imageUrl = await resolveRestaurantProfileImageSignedUrl(sb, path, 7200);
  if (!imageUrl) return null;
  return {
    imageUrl,
    imageLabel: kind === "cover" ? "Titelbild" : "Logo",
    source: "profile",
    sourceId: kind,
    storageBucket: "restaurant-profile-images",
    storagePath: path,
  };
}

function toClientIdea(c: SocialAutopilotCatalogIdea): SocialAutopilotIdea {
  return {
    id: c.id,
    slotKind: c.slotKind,
    sourceBucket: c.sourceBucket ?? sourceBucketForSlot(c.slotKind),
    title: c.title,
    reasonLabel: c.reasonLabel,
    reasonDetail: c.reasonDetail,
    imageUrl: c.imageUrl,
    imageLabel: c.imageLabel,
    theme: c.theme,
    captionDirection: c.captionDirection,
    suggestedFormat: c.suggestedFormat,
    aiSuggested: c.aiSuggested,
  };
}

function withBucket(
  idea: Omit<SocialAutopilotCatalogIdea, "sourceBucket"> & {
    sourceBucket?: SocialAutopilotCatalogIdea["sourceBucket"];
  },
): SocialAutopilotCatalogIdea {
  const sourceBucket =
    idea.sourceBucket ?? sourceBucketForSlot(idea.slotKind);
  const reasonLabel =
    sourceBucket === "menu"
      ? "Speisekarte"
      : sourceBucket === "gallery"
        ? "Galerie"
        : "KI-Ideen";
  return { ...idea, sourceBucket, reasonLabel };
}

/**
 * Ideen-Katalog (+ optional KI-Pitches) ohne Draft-Insert.
 * Generate übergibt `enrichWithAi: false` und nutzt Client-Hints.
 */
export async function listSocialAutopilotIdeas(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: {
    rotate?: boolean;
    forceSkipOpen?: boolean;
    /** Default true für Ideas-API; Generate = false (Hints vom Client). */
    enrichWithAi?: boolean;
  },
): Promise<SocialAutopilotIdeasResult> {
  const llmRuntime = await fetchRestaurantAssistantRuntime(restaurantId);
  const aiConfigured = Boolean(llmRuntime?.apiKey);
  const aiProvider = llmRuntime?.provider;
  const empty = (
    extra: Partial<SocialAutopilotIdeasResult> = {},
  ): SocialAutopilotIdeasResult => ({
    ideas: [],
    catalog: [],
    aiConfigured,
    aiProvider,
    tasksCreated: false,
    maxSelect: SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
    pendingOpen: 0,
    ...extra,
  });

  if (!aiConfigured) {
    return empty({ skippedReason: "ai_not_configured" });
  }

  const kit = await fetchSocialBrandKitFromDb(sb, restaurantId);
  if (!kit.enabled) {
    return empty({ skippedReason: "disabled" });
  }

  let forceSkipped = 0;
  if (opts?.forceSkipOpen) {
    forceSkipped = await skipPendingSocialSuggestionsInDb(sb, restaurantId);
  } else {
    // Ohne Force-Skip: nur stale/doppelte Feiertags-Drafts soft-skippen (Maria-Spam).
    await pruneStaleHolidaySocialSuggestionsInDb(sb, restaurantId);
  }

  const openExisting = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset"],
    limit: 80,
  });
  const pendingOpen = openExisting.length;

  // Dedupe gegen offene Drafts + approved/skipped der laufenden Woche.
  const history = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset", "approved", "skipped"],
    limit: 120,
  });
  const used = collectSocialAutopilotUsedKeys(history);
  const usedDishIds = used.dishIds;
  const usedGalleryIds = used.galleryIds;
  const usedEventIds = used.eventIds;
  const usedHolidayDates = used.holidayDates;
  const usedProfileIds = used.profileIds;
  const usedIdeaIds = used.ideaIds;

  const restaurant = await loadRestaurant(sb, restaurantId);
  if (!restaurant) {
    return empty({ skippedReason: "restaurant_missing", pendingOpen });
  }

  const now = new Date();
  const [dishesRaw, galleryRaw, eventsRaw] = await Promise.all([
    loadMenuDishes(sb, restaurantId),
    loadGalleryAssets(sb, restaurantId),
    loadUpcomingEvents(sb, restaurantId),
  ]);

  const coverAsset = await resolveProfileAsset(sb, restaurant, "cover");
  const avatarAsset = await resolveProfileAsset(sb, restaurant, "avatar");

  const rotateSeed = opts?.rotate
    ? `${restaurantId}:${ymd(now)}:${Date.now().toString(36)}`
    : `${restaurantId}:${ymd(now)}`;

  const dishes = rotateBySeed(dishesRaw, `${rotateSeed}:dish`).filter(
    (d) => !usedDishIds.has(d.id),
  );
  const gallery = rotateBySeed(galleryRaw, `${rotateSeed}:gallery`).filter(
    (g) => !usedGalleryIds.has(g.id),
  );
  const events = eventsRaw.filter(
    (e) =>
      !usedEventIds.has(e.id) &&
      isEventRelevantSoon(e.startAt, { now, lookaheadDays: 14 }),
  );

  const usableImageCount =
    dishes.length +
    gallery.length +
    (coverAsset && !usedProfileIds.has("cover") ? 1 : 0) +
    (avatarAsset && !usedProfileIds.has("avatar") ? 1 : 0) +
    events.length;

  let tasksCreated = false;
  if (usableImageCount < 5) {
    await ensureSocialUploadTaskInDb(sb, restaurantId);
    tasksCreated = true;
  }

  if (usableImageCount === 0) {
    return empty({
      skippedReason: "needs_media",
      tasksCreated,
      pendingOpen,
    });
  }

  const fromYmd = ymd(now);
  const toYmd = ymd(addDays(now, SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS));
  const holidays = filterRelevantHolidays(
    await listPublicHolidaysInRange(
      restaurant.country?.trim() || "Deutschland",
      fromYmd,
      toYmd,
    ),
    { now, lookaheadDays: SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS },
  ).filter((h) => !usedHolidayDates.has(h.date));

  const catalog: SocialAutopilotCatalogIdea[] = [];

  for (const ev of events) {
    catalog.push(
      withBucket({
        id: socialAutopilotIdeaId("event", ev.id),
        slotKind: "event",
        title: ev.title,
        reasonLabel: "KI-Ideen",
        reasonDetail: ev.title,
        imageUrl: ev.coverUrl,
        imageLabel: ev.title,
        eventStartAt: ev.startAt,
        asset: {
          imageUrl: ev.coverUrl,
          imageLabel: ev.title,
          source: "event",
          sourceId: ev.id,
          storageBucket: "events-media",
          storagePath: ev.coverStoragePath ?? undefined,
        },
      }),
    );
  }

  for (const dish of dishes) {
    catalog.push(
      withBucket({
        id: socialAutopilotIdeaId("menu", dish.id),
        slotKind: "menu_dish",
        title: dish.name,
        reasonLabel: "Speisekarte",
        reasonDetail: dish.name,
        imageUrl: dish.imageUrl,
        imageLabel: dish.name,
        dishDescription: dish.description || undefined,
        asset: {
          imageUrl: dish.imageUrl,
          imageLabel: dish.name,
          source: "menu",
          sourceId: dish.id,
        },
      }),
    );
  }

  for (const g of gallery) {
    catalog.push(
      withBucket({
        id: socialAutopilotIdeaId("gallery", g.id),
        slotKind: "ambient",
        title: g.label === "Galerie" ? "Ambiente" : g.label,
        reasonLabel: "Galerie",
        reasonDetail: g.label,
        imageUrl: g.imageUrl,
        imageLabel: g.label,
        asset: {
          imageUrl: g.imageUrl,
          imageLabel: g.label,
          source: "gallery",
          sourceId: g.id,
          storageBucket: "gallery-media",
          storagePath: g.storagePath,
        },
      }),
    );
  }

  // Feiertag nur mit Profilbild — max. 1, als KI-Stil.
  for (const h of holidays.slice(0, 1)) {
    let asset: SocialSuggestionAsset | null = null;
    if (coverAsset?.imageUrl && !usedProfileIds.has("cover")) {
      asset = coverAsset;
      usedProfileIds.add("cover");
    } else if (avatarAsset?.imageUrl && !usedProfileIds.has("avatar")) {
      asset = avatarAsset;
      usedProfileIds.add("avatar");
    }
    if (!asset?.imageUrl) break;
    catalog.push(
      withBucket({
        id: socialAutopilotIdeaId("holiday", h.date),
        slotKind: "holiday",
        title: h.name,
        reasonLabel: "KI-Ideen",
        reasonDetail: `${h.name} · ${h.date}`,
        imageUrl: asset.imageUrl,
        imageLabel: asset.imageLabel ?? h.name,
        holidayDate: h.date,
        holidayName: h.name,
        asset,
      }),
    );
  }

  // KI-Stil aus Brand Kit (optional) — Profilmedien als Bildträger.
  const brandAsset =
    coverAsset?.imageUrl && !usedProfileIds.has("cover")
      ? coverAsset
      : avatarAsset?.imageUrl && !usedProfileIds.has("avatar")
        ? avatarAsset
        : null;
  if (brandAsset?.imageUrl) {
    if (brandAsset.sourceId === "cover") usedProfileIds.add("cover");
    if (brandAsset.sourceId === "avatar") usedProfileIds.add("avatar");
    catalog.push(
      withBucket({
        id: socialAutopilotIdeaId("ai", "voice"),
        slotKind: "brand",
        sourceBucket: "ai",
        title: restaurant.name?.trim() || "Marke",
        reasonLabel: "KI-Ideen",
        reasonDetail: "Im euren Stil",
        imageUrl: brandAsset.imageUrl,
        imageLabel: brandAsset.imageLabel ?? "Marke",
        asset: brandAsset,
      }),
    );
  }

  // Quellen optional: Speisekarte · Galerie · KI-Stil (Events/Feiertag/Marke/Stimme).
  const seenIdea = new Set<string>();
  const dedupedCatalog = catalog.filter((c) => {
    if (usedIdeaIds.has(c.id) || seenIdea.has(c.id)) return false;
    seenIdea.add(c.id);
    return true;
  });

  const menuPart = rotateBySeed(
    dedupedCatalog.filter((c) => c.sourceBucket === "menu"),
    `${rotateSeed}:menu`,
  );
  const galleryPart = rotateBySeed(
    dedupedCatalog.filter((c) => c.sourceBucket === "gallery"),
    `${rotateSeed}:gallery`,
  );
  const aiPart = dedupedCatalog.filter((c) => c.sourceBucket === "ai");
  const ordered = [...menuPart, ...galleryPart, ...aiPart].slice(
    0,
    SOCIAL_AUTOPILOT_MAX_IDEAS_SHOWN,
  );

  // Kein `room || MAX` — bei voller Woche 0, sonst Endlos-Duplikate.
  const maxSelect = autopilotWeeklyRoom({
    weeklyPostTarget: kit.weeklyPostTarget,
    pendingOpen,
    maxPerRun: SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  });

  const restaurantName = restaurant.name?.trim() || "Unser Restaurant";
  const enrichWithAi = opts?.enrichWithAi !== false;
  let pitched = ordered;
  let ideasAiEnriched = false;
  let ideasLlmCalls = 0;

  if (enrichWithAi && llmRuntime?.apiKey) {
    const llmOutcome = await pitchAutopilotIdeasWithLlm({
      llm: llmRuntime,
      kit,
      restaurantName,
      ideas: ordered,
    });
    ideasLlmCalls = llmOutcome.llmCalls;
    if (llmOutcome.llmCalls > 0) {
      await insertRestaurantAiUsageEvent(sb, {
        restaurantId,
        source: "autopilot",
        provider: llmRuntime.provider,
        model: llmRuntime.model,
        promptTokens: llmOutcome.usage?.promptTokens ?? null,
        completionTokens: llmOutcome.usage?.completionTokens ?? null,
        totalTokens: llmOutcome.usage?.totalTokens ?? null,
        meta: {
          phase: "ideas",
          inputs: ordered.length,
          pitched: llmOutcome.pitches.length,
          ok: llmOutcome.ok,
        },
      });
    }
    pitched = applyIdeaPitchesToCatalog({
      catalog: ordered,
      pitches: llmOutcome.pitches,
      kit,
      fromLlm: llmOutcome.ok && llmOutcome.pitches.length > 0,
    });
    ideasAiEnriched = llmOutcome.ok && llmOutcome.pitches.length > 0;
  } else {
    pitched = ordered.map((idea) => {
      const pitch = heuristicIdeaPitch(idea, kit);
      return {
        ...idea,
        theme: pitch.theme,
        captionDirection: pitch.captionDirection,
        suggestedFormat: pitch.suggestedFormat,
        title: pitch.theme,
        aiSuggested: false,
      };
    });
  }

  return {
    ideas: pitched.map(toClientIdea),
    catalog: pitched,
    aiConfigured,
    aiProvider,
    tasksCreated,
    maxSelect,
    pendingOpen,
    forceSkipped,
    ideasAiEnriched,
    ideasLlmCalls,
  };
}
