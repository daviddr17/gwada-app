import "server-only";

import { USER_GUIDE_PAGES } from "@/lib/docs/handbuch";
import type { UserGuidePage } from "@/lib/docs/user-guide-content";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import { ymdHmToRestaurantIso } from "@/lib/restaurant/restaurant-timezone";
import {
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { defaultStaffReservationStatusId } from "@/lib/supabase/reservations-db";
import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import {
  assistantAsk,
  firstReservationQuestion,
  resolveReadYmdRange,
} from "@/lib/assistant/assistant-ask";
import { reservationPreviewSummary } from "@/lib/assistant/assistant-actions";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { withConfirmQuestion } from "@/lib/assistant/assistant-tool-auth";
import { weekdayLabelForLocale } from "@/lib/assistant/assistant-weekday-label";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";

function pagePlainText(page: UserGuidePage): string {
  const parts: string[] = [
    page.title,
    page.description,
    ...page.intro,
  ];
  for (const section of page.sections) {
    parts.push(section.heading);
    if (section.body) parts.push(section.body);
    if (section.items) parts.push(...section.items);
    if (section.steps) parts.push(...section.steps);
  }
  if (page.tips) parts.push(...page.tips);
  return parts.join("\n");
}

export async function reservationRangeIso(
  sb: SupabaseClient,
  restaurantId: string,
  start: string,
  end: string,
): Promise<{ startIso: string; endIso: string; timeZone: string } | { error: string }> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, restaurantId);
  try {
    const startIso = ymdHmToRestaurantIso(start, "00:00", timeZone);
    const endDate = new Date(`${end}T12:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const endExclusiveYmd = endDate.toISOString().slice(0, 10);
    const endIso = ymdHmToRestaurantIso(endExclusiveYmd, "00:00", timeZone);
    return { startIso, endIso, timeZone };
  } catch {
    return { error: "Ungültiger Zeitraum." };
  }
}

export async function toolCountReservations(
  ctx: AssistantToolContext,
  args: { start_ymd?: string; end_ymd?: string; date_ymd?: string; scope?: string; restaurant_name?: string },
  locale: AppLocale = DEFAULT_APP_LOCALE,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") {
    return JSON.stringify({ ok: false, ask: target.ask });
  }

  const timeZone = await fetchRestaurantTimezoneServer(
    ctx.sb,
    target.kind === "one" ? target.restaurantId : ctx.restaurantId,
  );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const range = resolveReadYmdRange({
    today,
    dateYmd: args.date_ymd,
    startYmd: args.start_ymd,
    endYmd: args.end_ymd,
    locale,
  });
  if ("ask" in range) return JSON.stringify({ ok: false, ask: range.ask });

  if (target.kind === "one" && !ctx.callerIsSuperadmin) {
    const auth = await authorizeModuleCrud(target.restaurantId, "reservations", "read");
    if (!auth.ok) {
      return JSON.stringify({
        ok: false,
        error: "Keine Berechtigung, Reservierungen zu lesen.",
      });
    }
  }

  const bounds = await reservationRangeIso(
    ctx.sb,
    target.kind === "one" ? target.restaurantId : ctx.restaurantId,
    range.start,
    range.end,
  );
  if ("error" in bounds) {
    return JSON.stringify({ ok: false, ask: assistantAsk(locale, "whichDate") });
  }

  let query = target.sb
    .from("reservations")
    .select("party_size")
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso);
  if (target.kind === "one") query = query.eq("restaurant_id", target.restaurantId);

  const { data, error } = await query;
  if (error) return JSON.stringify({ ok: false, error: error.message });

  const rows = data ?? [];
  const guests = rows.reduce(
    (sum, r) => sum + (typeof r.party_size === "number" ? r.party_size : 0),
    0,
  );

  return JSON.stringify({
    ok: true,
    scope: target.kind,
    restaurant_name: target.kind === "one" ? target.restaurantName : null,
    start_ymd: range.start,
    end_ymd: range.end,
    time_zone: bounds.timeZone,
    reservation_count: rows.length,
    guest_count: guests,
  });
}

export async function toolSearchHandbook(
  _ctx: AssistantToolContext,
  args: { query: string },
): Promise<string> {
  const q = args.query?.trim().toLowerCase() ?? "";
  if (q.length < 2) {
    return JSON.stringify({
      ok: false,
      error: "Suchbegriff zu kurz.",
    });
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  const scored = USER_GUIDE_PAGES.map((page) => {
    const hay = pagePlainText(page).toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (page.slug.includes(t)) score += 5;
      if (page.title.toLowerCase().includes(t)) score += 4;
      if (hay.includes(t)) score += 1;
    }
    return { page, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) {
    return JSON.stringify({
      ok: true,
      matches: [],
      hint: "Kein Handbuch-Treffer. Formuliere die Frage anders.",
    });
  }

  return JSON.stringify({
    ok: true,
    matches: scored.map(({ page }) => ({
      slug: page.slug,
      title: page.title,
      description: page.description,
      intro: page.intro.slice(0, 2),
      sections: page.sections.slice(0, 3).map((s) => ({
        heading: s.heading,
        body: s.body?.slice(0, 400) ?? null,
        steps: s.steps?.slice(0, 6) ?? null,
        items: s.items?.slice(0, 6) ?? null,
      })),
      tips: page.tips?.slice(0, 3) ?? [],
      href: `/docs/handbook/${page.slug}`,
    })),
  });
}

export async function toolGetRestaurantRules(
  ctx: AssistantToolContext,
  options?: { locale?: string | null; scope?: string; restaurant_name?: string },
): Promise<string> {
  const locale = normalizeAppLocale(options?.locale ?? DEFAULT_APP_LOCALE);
  const target = await resolveAssistantTarget(
    ctx,
    { scope: options?.scope, restaurant_name: options?.restaurant_name },
    locale,
    "read",
  );
  if (target.kind === "ask") return JSON.stringify({ ok: false, ask: target.ask });
  if (target.kind === "all") {
    return JSON.stringify({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }

  const timeZone = await fetchRestaurantTimezoneServer(ctx.sb, target.restaurantId);

  const [{ data: hours }, { data: settings }, { data: restaurant }] =
    await Promise.all([
      target.sb
        .from("opening_hours")
        .select(
          "kind, weekday, exception_date, closed, opens_at, closes_at, schedule_role, note",
        )
        .eq("restaurant_id", target.restaurantId)
        .eq("schedule_role", "business"),
      target.sb
        .from("restaurant_reservation_settings")
        .select("default_dwell_minutes, booking_lead_time_hours")
        .eq("restaurant_id", target.restaurantId)
        .maybeSingle(),
      target.sb
        .from("restaurants")
        .select("name")
        .eq("id", target.restaurantId)
        .maybeSingle(),
    ]);

  const weekly = (hours ?? []).filter((h) => h.kind === "weekly");
  const exceptions = (hours ?? [])
    .filter((h) => h.kind === "exception")
    .slice(0, 20);

  return JSON.stringify({
    ok: true,
    restaurant_name: restaurant?.name ?? null,
    time_zone: timeZone,
    locale,
    weekly_hours: weekly.map((h) => ({
      weekday: h.weekday,
      weekday_label: weekdayLabelForLocale(h.weekday, locale, "long"),
      closed: h.closed,
      opens_at: h.opens_at,
      closes_at: h.closes_at,
    })),
    upcoming_exceptions: exceptions.map((h) => ({
      date: h.exception_date,
      closed: h.closed,
      opens_at: h.opens_at,
      closes_at: h.closes_at,
      note: h.note,
    })),
    reservation_settings: settings
      ? {
          default_dwell_minutes: settings.default_dwell_minutes,
          booking_lead_time_hours: settings.booking_lead_time_hours ?? null,
        }
      : null,
  });
}

export async function toolCreateReservation(
  ctx: AssistantToolContext,
  args: {
    date_ymd: string;
    time_hm: string;
    party_size: number;
    guest_first_name: string;
    guest_last_name?: string | null;
    guest_phone?: string | null;
    notes?: string | null;
    confirm?: boolean;
    scope?: string;
    restaurant_name?: string;
  },
  locale: AppLocale = DEFAULT_APP_LOCALE,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return JSON.stringify({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return JSON.stringify({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const auth = await authorizeModuleCrud(target.restaurantId, "reservations", "create");
  if (!auth.ok) {
    return JSON.stringify({
      ok: false,
      error: "Keine Berechtigung, Reservierungen anzulegen.",
    });
  }

  const gap = firstReservationQuestion(args, locale);
  if (gap) {
    return JSON.stringify({
      ok: false,
      needs_fields: [gap.field],
      ask: gap.ask,
    });
  }

  const dateYmd = args.date_ymd.trim();
  const timeHm = args.time_hm.trim();
  const partySize = Number(args.party_size);
  const firstName = normalizeReservationGuestFirstName(args.guest_first_name ?? "");
  const lastName = normalizeReservationGuestLastName(args.guest_last_name ?? "");
  if (!firstName) {
    return JSON.stringify({ ok: false, ask: assistantAsk(locale, "guest") });
  }

  const preview = {
    date_ymd: dateYmd,
    time_hm: timeHm,
    party_size: partySize,
    guest_first_name: firstName,
    guest_last_name: lastName || null,
    guest_phone: args.guest_phone?.trim() || null,
    notes: args.notes?.trim() || null,
    restaurant_name: target.restaurantName,
  };

  if (!args.confirm) {
    return JSON.stringify({
      ok: true,
      status: "draft",
      preview,
      message: withConfirmQuestion(
        reservationPreviewSummary(preview, locale),
        locale,
      ),
    });
  }

  const timeZone = await fetchRestaurantTimezoneServer(target.sb, target.restaurantId);
  const { data: settings } = await target.sb
    .from("restaurant_reservation_settings")
    .select("default_dwell_minutes")
    .eq("restaurant_id", target.restaurantId)
    .maybeSingle();
  const dwell = settings?.default_dwell_minutes ?? 120;

  const { data: statuses, error: statusErr } = await target.sb
    .from("reservation_statuses")
    .select("id, code, name, color_hex")
    .order("sort_order", { ascending: true });
  if (statusErr) {
    return JSON.stringify({ ok: false, error: statusErr.message });
  }
  const statusId = defaultStaffReservationStatusId(statuses ?? []);
  if (!statusId) {
    return JSON.stringify({
      ok: false,
      error: "Kein Reservierungsstatus verfügbar.",
    });
  }

  let startsIso: string;
  try {
    startsIso = ymdHmToRestaurantIso(dateYmd, timeHm, timeZone);
  } catch {
    return JSON.stringify({ ok: false, error: "Ungültiges Datum oder Uhrzeit." });
  }
  const startMs = new Date(startsIso).getTime();
  if (Number.isNaN(startMs)) {
    return JSON.stringify({ ok: false, error: "Ungültiges Datum oder Uhrzeit." });
  }
  const endsIso = new Date(startMs + dwell * 60 * 1000).toISOString();

  const { data: created, error: insErr } = await target.sb
    .from("reservations")
    .insert({
      restaurant_id: target.restaurantId,
      kind: "guest",
      guest_first_name: firstName,
      guest_last_name: lastName || "",
      guest_company: null,
      guest_phone: preview.guest_phone,
      guest_email: null,
      party_size: partySize,
      starts_at: startsIso,
      ends_at: endsIso,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: false,
      notify_whatsapp: false,
      terms_accepted: true,
      notes: preview.notes,
    })
    .select("id, reservation_number")
    .single();

  if (insErr) {
    return JSON.stringify({ ok: false, error: insErr.message });
  }

  return JSON.stringify({
    ok: true,
    status: "created",
    reservation_id: created.id,
    reservation_number: created.reservation_number,
    preview,
    starts_at: startsIso,
    ends_at: endsIso,
  });
}
