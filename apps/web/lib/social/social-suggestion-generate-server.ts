import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clampAutopilotItemCount,
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
} from "@/lib/social/social-autopilot-bounds";
import {
  applyAutopilotCaptionResults,
  rewriteAutopilotCaptionsWithLlm,
  type SocialAutopilotCaptionJob,
} from "@/lib/social/social-autopilot-llm";
import {
  listSocialAutopilotIdeas,
  type SocialAutopilotCatalogIdea,
} from "@/lib/social/social-autopilot-ideas-server";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import {
  feedLayoutToLegacyTemplate,
  pickFeedLayoutForSlot,
} from "@/lib/social/social-feed-layout";
import type { SocialFeedLayoutId } from "@/lib/social/social-feed-brand-system";
import {
  captionForAmbient,
  captionForBrand,
  captionForDish,
  captionForEvent,
  captionForHoliday,
  overlayLineFromCaption,
  titleForAmbient,
} from "@/lib/social/social-caption-templates";
import type {
  SocialBrandKit,
  SocialTemplateId,
  SocialTone,
} from "@/lib/social/social-brand-kit";
import { SOCIAL_TONES } from "@/lib/social/social-brand-kit";
import {
  insertSocialSuggestionsInDb,
  listSocialSuggestionsFromDb,
} from "@/lib/social/social-suggestions-db";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";
import { parseSocialPublishPlatforms } from "@/lib/social/social-publish-platforms";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

function startOfWeekMonday(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(base: Date, days: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + days);
  return x;
}

function plannedAtForDay(weekStart: Date, dayOffset: number, hour = 11): string {
  const d = addDays(weekStart, dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function formatEventWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export type SocialSuggestionGenerateResult = {
  created: number;
  pending: number;
  tasksCreated: boolean;
  skippedReason?: string;
  aiConfigured: boolean;
  aiProvider?: "openai" | "grok";
  llmCalls?: number;
  llmApplied?: number;
  caps?: {
    maxItemsPerRun: number;
    maxLlmCalls: number;
  };
};

type Draft = {
  restaurantId: string;
  status: "pending" | "needs_asset";
  slotKind: "holiday" | "menu_dish" | "event" | "brand" | "ambient";
  templateId: SocialTemplateId;
  plannedAt: string;
  title: string | null;
  caption: string;
  platforms: string[];
  source: Record<string, unknown>;
  asset: SocialSuggestionAsset;
};

function draftFromIdea(params: {
  idea: SocialAutopilotCatalogIdea;
  restaurantId: string;
  restaurantName: string;
  kit: SocialBrandKit;
  plannedAt: string;
  feedLayout: SocialFeedLayoutId;
}): Draft | null {
  const { idea, restaurantId, restaurantName, kit, plannedAt, feedLayout } =
    params;
  if (!idea.asset.imageUrl) return null;

  const withOverlay = (
    caption: string,
    source: Record<string, unknown>,
  ): Record<string, unknown> => ({
    ...source,
    overlayLine: overlayLineFromCaption(caption, kit),
    ideaId: idea.id,
  });

  if (idea.slotKind === "event") {
    const whenLabel = formatEventWhen(idea.eventStartAt ?? plannedAt);
    const caption = captionForEvent({
      kit,
      restaurantName,
      eventTitle: idea.title,
      whenLabel,
    });
    return {
      restaurantId,
      status: "pending",
      slotKind: "event",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt,
      title: idea.title,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        eventId: idea.asset.sourceId,
        startAt: idea.eventStartAt,
        feedLayout,
        contentReason: "event",
      }),
      asset: idea.asset,
    };
  }

  if (idea.slotKind === "menu_dish") {
    const caption = captionForDish({
      kit,
      restaurantName,
      dishName: idea.title,
      dishDescription: idea.dishDescription,
    });
    return {
      restaurantId,
      status: "pending",
      slotKind: "menu_dish",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt,
      title: idea.title,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        dishId: idea.asset.sourceId,
        dishName: idea.title,
        ...(idea.dishDescription
          ? { dishDescription: idea.dishDescription.slice(0, 160) }
          : {}),
        feedLayout,
        contentReason: "menu_dish",
      }),
      asset: idea.asset,
    };
  }

  if (idea.slotKind === "ambient") {
    const caption = captionForAmbient({
      kit,
      restaurantName,
      imageCaption: idea.imageLabel,
    });
    return {
      restaurantId,
      status: "pending",
      slotKind: "ambient",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt,
      title: titleForAmbient(idea.imageLabel),
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        galleryItemId: idea.asset.sourceId,
        imageCaption: idea.imageLabel,
        feedLayout,
        contentReason: "ambient",
      }),
      asset: idea.asset,
    };
  }

  if (idea.slotKind === "holiday") {
    const holidayName = idea.holidayName ?? idea.title;
    const caption = captionForHoliday({
      kit,
      restaurantName,
      holidayName,
    });
    return {
      restaurantId,
      status: "pending",
      slotKind: "holiday",
      templateId: feedLayoutToLegacyTemplate(feedLayout),
      plannedAt: idea.holidayDate
        ? `${idea.holidayDate}T10:00:00.000Z`
        : plannedAt,
      title: holidayName,
      caption,
      platforms: [...kit.publishPlatforms],
      source: withOverlay(caption, {
        date: idea.holidayDate,
        holidayName,
        feedLayout,
        contentReason: "holiday",
      }),
      asset: idea.asset,
    };
  }

  const caption = captionForBrand({ kit, restaurantName });
  return {
    restaurantId,
    status: "pending",
    slotKind: "brand",
    templateId: feedLayoutToLegacyTemplate(feedLayout),
    plannedAt,
    title: restaurantName,
    caption,
    platforms: [...kit.publishPlatforms],
    source: withOverlay(caption, {
      kind: "brand",
      feedLayout,
      contentReason: "brand",
    }),
    asset: idea.asset,
  };
}

/**
 * Erzeugt Drafts nur für vom User gewählte Ideen.
 * Ohne `ideaIds` → keine Blind-Generierung (Auswahlpflicht).
 */
export async function generateSocialSuggestionsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: {
    ideaIds?: string[];
    force?: boolean;
    /** Session-Override aus der Auswahl-UI (sonst Brand Kit). */
    tone?: SocialTone;
    platforms?: string[];
  },
): Promise<SocialSuggestionGenerateResult> {
  const caps = {
    maxItemsPerRun: SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
    maxLlmCalls: SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
  };

  const llmRuntime = await fetchRestaurantAssistantRuntime(restaurantId);
  const aiConfigured = Boolean(llmRuntime?.apiKey);
  const aiProvider = llmRuntime?.provider;

  if (!aiConfigured || !llmRuntime) {
    return {
      created: 0,
      pending: 0,
      tasksCreated: false,
      skippedReason: "ai_not_configured",
      aiConfigured: false,
      caps,
    };
  }

  const ideaIds = (opts?.ideaIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);
  // force ohne Auswahl = früherer Blind-Pfad — nicht mehr erlaubt.
  if (ideaIds.length === 0) {
    const existing = await listSocialSuggestionsFromDb(sb, restaurantId, {
      statuses: ["pending", "needs_asset"],
      limit: 40,
    });
    return {
      created: 0,
      pending: existing.length,
      tasksCreated: false,
      skippedReason: "selection_required",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const kitBase = await fetchSocialBrandKitFromDb(sb, restaurantId);
  if (!kitBase.enabled) {
    return {
      created: 0,
      pending: 0,
      tasksCreated: false,
      skippedReason: "disabled",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const toneOverride =
    opts?.tone && SOCIAL_TONES.includes(opts.tone) ? opts.tone : null;
  const platformsOverride = opts?.platforms
    ? parseSocialPublishPlatforms(opts.platforms)
    : null;
  const kit: SocialBrandKit = {
    ...kitBase,
    ...(toneOverride ? { tone: toneOverride } : {}),
    ...(platformsOverride && platformsOverride.length > 0
      ? { publishPlatforms: platformsOverride }
      : {}),
  };

  const ideasResult = await listSocialAutopilotIdeas(sb, restaurantId, {
    rotate: false,
  });
  if (ideasResult.skippedReason === "needs_media") {
    return {
      created: 0,
      pending: ideasResult.pendingOpen,
      tasksCreated: ideasResult.tasksCreated,
      skippedReason: "needs_media",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const byId = new Map(ideasResult.catalog.map((c) => [c.id, c]));
  const selected: SocialAutopilotCatalogIdea[] = [];
  const seen = new Set<string>();
  for (const id of ideaIds) {
    if (seen.has(id)) continue;
    const hit = byId.get(id);
    if (!hit?.asset.imageUrl) continue;
    seen.add(id);
    selected.push(hit);
  }

  const need = clampAutopilotItemCount(
    Math.min(selected.length, ideasResult.maxSelect),
  );
  const picked = selected.slice(0, need);

  if (picked.length === 0) {
    return {
      created: 0,
      pending: ideasResult.pendingOpen,
      tasksCreated: ideasResult.tasksCreated,
      skippedReason: "selection_required",
      aiConfigured,
      aiProvider,
      caps,
    };
  }

  const { data: restaurant } = await sb
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  const restaurantName =
    (typeof restaurant?.name === "string" && restaurant.name.trim()) ||
    "Unser Restaurant";

  const existing = await listSocialSuggestionsFromDb(sb, restaurantId, {
    statuses: ["pending", "needs_asset"],
    limit: 40,
  });
  const weekStart = startOfWeekMonday();
  const daySlots = [1, 3, 5, 2, 4, 6, 0];
  let slotIndex = 0;
  const recentLayouts: SocialFeedLayoutId[] = existing
    .map((s) => {
      const raw = s.source.feedLayout;
      return typeof raw === "string" ? (raw as SocialFeedLayoutId) : null;
    })
    .filter((x): x is SocialFeedLayoutId => Boolean(x));

  const nextPlan = () => {
    const day = daySlots[slotIndex % daySlots.length] ?? 1;
    slotIndex += 1;
    return plannedAtForDay(weekStart, day, 11 + (slotIndex % 2));
  };

  const drafts: Draft[] = [];
  for (const idea of picked) {
    const avoid = recentLayouts.slice(-2);
    const feedLayout = pickFeedLayoutForSlot({
      slotKind: idea.slotKind,
      preferredLayouts: kit.preferredLayouts,
      avoidLayouts: avoid,
    });
    recentLayouts.push(feedLayout);
    const draft = draftFromIdea({
      idea,
      restaurantId,
      restaurantName,
      kit,
      plannedAt: nextPlan(),
      feedLayout,
    });
    if (draft) drafts.push(draft);
  }

  if (drafts.length === 0) {
    return {
      created: 0,
      pending: existing.length,
      tasksCreated: ideasResult.tasksCreated,
      skippedReason: "needs_media",
      aiConfigured,
      aiProvider,
      llmCalls: 0,
      llmApplied: 0,
      caps,
    };
  }

  const captionJobs: SocialAutopilotCaptionJob[] = drafts.map((d, index) => {
    const facts: Record<string, string> = { slotKind: d.slotKind };
    if (typeof d.source.dishName === "string") facts.dishName = d.source.dishName;
    if (typeof d.source.dishDescription === "string") {
      facts.dishDescription = d.source.dishDescription;
    }
    if (typeof d.source.holidayName === "string") {
      facts.holidayName = d.source.holidayName;
    }
    if (typeof d.source.date === "string") facts.date = d.source.date;
    if (typeof d.source.eventId === "string") facts.eventId = d.source.eventId;
    if (typeof d.source.startAt === "string") {
      facts.whenLabel = formatEventWhen(String(d.source.startAt));
    }
    if (typeof d.source.imageCaption === "string") {
      facts.imageCaption = d.source.imageCaption;
    }
    if (d.title) facts.title = d.title;
    if (d.asset.imageLabel) facts.imageLabel = d.asset.imageLabel;
    return {
      index,
      slotKind: d.slotKind,
      title: d.title,
      imageLabel: d.asset.imageLabel ?? null,
      facts,
      templateCaption: d.caption,
    };
  });

  const llmOutcome = await rewriteAutopilotCaptionsWithLlm({
    llm: llmRuntime,
    kit,
    restaurantName,
    jobs: captionJobs,
  });

  const applied = applyAutopilotCaptionResults({
    captions: drafts.map((d) => d.caption),
    titles: drafts.map((d) => d.title),
    sources: drafts.map((d) => d.source),
    kit,
    llmResults: llmOutcome.results,
  });

  for (let i = 0; i < drafts.length; i++) {
    drafts[i]!.caption = applied.captions[i] ?? drafts[i]!.caption;
    drafts[i]!.title = applied.titles[i] ?? drafts[i]!.title;
    drafts[i]!.source = applied.sources[i] ?? drafts[i]!.source;
  }

  const created = await insertSocialSuggestionsInDb(sb, drafts);
  return {
    created,
    pending: existing.length + created,
    tasksCreated: ideasResult.tasksCreated,
    aiConfigured,
    aiProvider,
    llmCalls: llmOutcome.llmCalls,
    llmApplied: applied.llmApplied,
    caps,
  };
}
