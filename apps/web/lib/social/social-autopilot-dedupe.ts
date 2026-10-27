import { socialAutopilotIdeaId } from "@/lib/social/social-autopilot-ideas";
import type { SocialPostSuggestion } from "@/lib/social/social-suggestion-types";

/** Quellen / ideaIds, die nicht erneut als Idee vorgeschlagen werden. */
export type SocialAutopilotUsedKeys = {
  ideaIds: Set<string>;
  dishIds: Set<string>;
  galleryIds: Set<string>;
  eventIds: Set<string>;
  holidayDates: Set<string>;
  profileIds: Set<string>;
};

export function emptySocialAutopilotUsedKeys(): SocialAutopilotUsedKeys {
  return {
    ideaIds: new Set(),
    dishIds: new Set(),
    galleryIds: new Set(),
    eventIds: new Set(),
    holidayDates: new Set(),
    profileIds: new Set(),
  };
}

function startOfWeekMonday(d = new Date()): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

/** Offene Drafts immer; sonst nur aktuelle ISO-Woche (Mo–So). */
export function suggestionCountsTowardAutopilotDedupe(
  suggestion: Pick<SocialPostSuggestion, "status" | "createdAt" | "plannedAt">,
  now = new Date(),
): boolean {
  if (suggestion.status === "pending" || suggestion.status === "needs_asset") {
    return true;
  }
  if (
    suggestion.status !== "approved" &&
    suggestion.status !== "skipped"
  ) {
    return false;
  }
  const weekStart = startOfWeekMonday(now).getTime();
  const created = Date.parse(suggestion.createdAt);
  const planned = Date.parse(suggestion.plannedAt);
  const ts = Number.isFinite(created)
    ? created
    : Number.isFinite(planned)
      ? planned
      : NaN;
  if (!Number.isFinite(ts)) return true;
  return ts >= weekStart;
}

/**
 * Sammelt bereits genutzte Ideen-Schlüssel aus Suggestions
 * (pending immer, approved/skipped in der laufenden Woche).
 */
export function collectSocialAutopilotUsedKeys(
  suggestions: ReadonlyArray<
    Pick<
      SocialPostSuggestion,
      "status" | "slotKind" | "source" | "asset" | "createdAt" | "plannedAt"
    >
  >,
  now = new Date(),
): SocialAutopilotUsedKeys {
  const used = emptySocialAutopilotUsedKeys();

  for (const s of suggestions) {
    if (!suggestionCountsTowardAutopilotDedupe(s, now)) continue;

    const ideaIdRaw = s.source.ideaId;
    if (typeof ideaIdRaw === "string" && ideaIdRaw.trim()) {
      used.ideaIds.add(ideaIdRaw.trim());
    }

    if (s.slotKind === "menu_dish") {
      const dishId = String(s.source.dishId ?? s.asset.sourceId ?? "").trim();
      if (dishId) {
        used.dishIds.add(dishId);
        used.ideaIds.add(socialAutopilotIdeaId("menu", dishId));
      }
    }

    if (s.asset.source === "menu" && s.asset.sourceId) {
      const dishId = String(s.asset.sourceId).trim();
      if (dishId) {
        used.dishIds.add(dishId);
        used.ideaIds.add(socialAutopilotIdeaId("menu", dishId));
      }
    }

    if (s.asset.source === "gallery" && s.asset.sourceId) {
      const gid = String(s.asset.sourceId).trim();
      if (gid) {
        used.galleryIds.add(gid);
        used.ideaIds.add(socialAutopilotIdeaId("gallery", gid));
      }
    } else {
      const gid = String(s.source.galleryItemId ?? "").trim();
      if (gid) {
        used.galleryIds.add(gid);
        used.ideaIds.add(socialAutopilotIdeaId("gallery", gid));
      }
    }

    if (s.slotKind === "event") {
      const eid = String(s.source.eventId ?? s.asset.sourceId ?? "").trim();
      if (eid) {
        used.eventIds.add(eid);
        used.ideaIds.add(socialAutopilotIdeaId("event", eid));
      }
    }

    if (s.slotKind === "holiday") {
      const date = String(s.source.date ?? "").trim();
      if (date) {
        used.holidayDates.add(date);
        used.ideaIds.add(socialAutopilotIdeaId("holiday", date));
      }
    }

    if (s.asset.source === "profile" && s.asset.sourceId) {
      const pid = String(s.asset.sourceId).trim();
      if (pid) {
        used.profileIds.add(pid);
        used.ideaIds.add(socialAutopilotIdeaId("brand", pid));
      }
    }

    if (s.slotKind === "brand") {
      const kind = String(s.source.kind ?? "").trim();
      if (kind === "brand") {
        // Cover/Avatar über asset.sourceId
        const pid = String(s.asset.sourceId ?? "").trim();
        if (pid) {
          used.profileIds.add(pid);
          used.ideaIds.add(socialAutopilotIdeaId("brand", pid));
        }
      }
    }
  }

  return used;
}

/** Wochenkapazität: wie viele neue Drafts noch erlaubt sind. */
export function autopilotWeeklyRoom(params: {
  weeklyPostTarget: number;
  pendingOpen: number;
  maxPerRun: number;
}): number {
  const target = Math.max(0, Math.floor(params.weeklyPostTarget));
  const pending = Math.max(0, Math.floor(params.pendingOpen));
  const room = Math.max(0, target - pending);
  return Math.min(Math.max(0, Math.floor(params.maxPerRun)), room);
}
