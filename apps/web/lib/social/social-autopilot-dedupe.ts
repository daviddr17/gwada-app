import { socialAutopilotIdeaId } from "@/lib/social/social-autopilot-ideas";
import type { SocialPostSuggestion } from "@/lib/social/social-suggestion-types";
import { SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS } from "@/lib/social/social-autopilot-relevance";

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

function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return ymdLocal(d);
}

/** Feiertags-Datum aus source.date oder plannedAt (YYYY-MM-DD). */
export function holidaySuggestionDateYmd(
  suggestion: Pick<SocialPostSuggestion, "source" | "plannedAt">,
): string | null {
  const raw = suggestion.source?.date;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  const planned = Date.parse(suggestion.plannedAt);
  if (!Number.isFinite(planned)) return null;
  return ymdLocal(new Date(planned));
}

/**
 * Offene Feiertags-Drafts, die die Liste zuspammen:
 * - Datum in der Vergangenheit oder jenseits Lookahead
 * - Duplikate desselben Datums (nur neuester bleibt)
 */
export function selectStaleOrDuplicateHolidayIdsToSkip(
  suggestions: ReadonlyArray<
    Pick<
      SocialPostSuggestion,
      "id" | "status" | "slotKind" | "source" | "plannedAt" | "createdAt"
    >
  >,
  opts?: { now?: Date; lookaheadDays?: number },
): string[] {
  const now = opts?.now ?? new Date();
  const lookahead =
    opts?.lookaheadDays ?? SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS;
  const today = ymdLocal(now);
  const maxDate = addDaysYmd(today, Math.max(0, lookahead));

  type Row = {
    id: string;
    date: string | null;
    createdAt: string;
  };

  const openHolidays: Row[] = [];
  for (const s of suggestions) {
    if (s.slotKind !== "holiday") continue;
    if (s.status !== "pending" && s.status !== "needs_asset") continue;
    openHolidays.push({
      id: s.id,
      date: holidaySuggestionDateYmd(s),
      createdAt: s.createdAt,
    });
  }

  const skip = new Set<string>();
  const byDate = new Map<string, Row[]>();

  for (const row of openHolidays) {
    if (!row.date || row.date < today || row.date > maxDate) {
      skip.add(row.id);
      continue;
    }
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  for (const list of byDate.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => {
      const ta = Date.parse(a.createdAt);
      const tb = Date.parse(b.createdAt);
      const aOk = Number.isFinite(ta) ? ta : 0;
      const bOk = Number.isFinite(tb) ? tb : 0;
      return bOk - aOk;
    });
    for (const dup of list.slice(1)) {
      skip.add(dup.id);
    }
  }

  return [...skip];
}
