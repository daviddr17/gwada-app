import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPublicHolidaysInRange } from "@/lib/holidays/public-holidays-server";
import {
  filterRelevantHolidays,
  isEventRelevantSoon,
  SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS,
} from "@/lib/social/social-autopilot-relevance";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type SocialKiCue = {
  id: string;
  kind: "holiday" | "event";
  label: string;
  /** Text fürs Freitext-Feld */
  prompt: string;
  detail?: string;
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatCueDate(isoOrYmd: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)
    ? new Date(`${isoOrYmd}T12:00:00`)
    : new Date(isoOrYmd);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Leichte Hinweise für KI-Post-Vorgaben — kein LLM.
 * Feiertage + kommende Events zum Antippen ins Freitext-Feld.
 */
export async function listSocialKiCues(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<SocialKiCue[]> {
  if (!isUuidRestaurantId(restaurantId)) return [];

  const now = new Date();
  const { data: restaurant } = await sb
    .from("restaurants")
    .select("country")
    .eq("id", restaurantId)
    .maybeSingle();

  const country =
    (typeof restaurant?.country === "string" && restaurant.country.trim()) ||
    "Deutschland";

  const fromYmd = ymd(now);
  const toYmd = ymd(addDays(now, Math.max(SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS, 14)));

  const [holidaysRaw, eventRows] = await Promise.all([
    listPublicHolidaysInRange(country, fromYmd, toYmd),
    sb
      .from("gwada_events")
      .select("id, title, start_at, status")
      .eq("restaurant_id", restaurantId)
      .in("status", ["published", "scheduled", "draft"])
      .gte("start_at", now.toISOString())
      .order("start_at", { ascending: true })
      .limit(8)
      .then((r) => r.data ?? []),
  ]);

  const holidays = filterRelevantHolidays(holidaysRaw, {
    now,
    lookaheadDays: SOCIAL_AUTOPILOT_HOLIDAY_LOOKAHEAD_DAYS,
    maxSlots: 3,
  });

  const cues: SocialKiCue[] = [];

  for (const h of holidays) {
    const when = formatCueDate(h.date);
    cues.push({
      id: `holiday:${h.date}`,
      kind: "holiday",
      label: h.name,
      detail: when || undefined,
      prompt: `Post zu ${h.name}${when ? ` (${when})` : ""} — einladend, ohne erfundenes Angebot.`,
    });
  }

  for (const row of eventRows) {
    const startAt = typeof row.start_at === "string" ? row.start_at : "";
    if (!startAt || !isEventRelevantSoon(startAt, { now, lookaheadDays: 14 })) {
      continue;
    }
    const title = String(row.title ?? "").trim() || "Event";
    const when = formatCueDate(startAt);
    cues.push({
      id: `event:${row.id}`,
      kind: "event",
      label: title,
      detail: when || undefined,
      prompt: `Post zu unserem Event „${title}“${when ? ` am ${when}` : ""} — Gäste einladen.`,
    });
    if (cues.filter((c) => c.kind === "event").length >= 3) break;
  }

  return cues.slice(0, 6);
}
