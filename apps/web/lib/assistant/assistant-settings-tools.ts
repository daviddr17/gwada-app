import "server-only";

import type {
  AssistantOpeningHoursDayChange,
  AssistantOpeningHoursExceptionChange,
  AssistantOpeningHoursPreview,
} from "@/lib/assistant/assistant-actions";
import { assistantAsk } from "@/lib/assistant/assistant-ask";
import {
  assistantJson,
  denyUnlessModuleCrud,
  denyUnlessPermission,
  draftMutation,
  withConfirmQuestion,
} from "@/lib/assistant/assistant-tool-auth";
import { weekdayLabelForLocale } from "@/lib/assistant/assistant-weekday-label";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import { WEEKDAY_ORDER } from "@/lib/constants/restaurant-profile";
import { syncOpeningHoursToFacebook } from "@/lib/integrations/facebook-hours-sync-server";
import { syncOpeningHoursToGoogleBusiness } from "@/lib/integrations/google-business-hours-sync-server";
import { loadOpeningHoursPayloadAdmin } from "@/lib/integrations/opening-hours-load-server";
import { syncRestaurantReviewsPlatforms } from "@/lib/reviews/reviews-feed-sync-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  normalizeScheduleHHmm,
  replaceOpeningHoursWithClient,
} from "@/lib/supabase/opening-hours-db";
import type { DayHours, Weekday } from "@/lib/types/restaurant";
import type { AppLocale } from "@/i18n/config";

function json(value: unknown): string {
  return assistantJson(value);
}

const WEEKDAY_ALIASES: Record<string, Weekday> = {
  monday: "monday",
  mon: "monday",
  montag: "monday",
  mo: "monday",
  tuesday: "tuesday",
  tue: "tuesday",
  dienstag: "tuesday",
  di: "tuesday",
  wednesday: "wednesday",
  wed: "wednesday",
  mittwoch: "wednesday",
  mi: "wednesday",
  thursday: "thursday",
  thu: "thursday",
  donnerstag: "thursday",
  do: "thursday",
  friday: "friday",
  fri: "friday",
  freitag: "friday",
  fr: "friday",
  saturday: "saturday",
  sat: "saturday",
  samstag: "saturday",
  sa: "saturday",
  sunday: "sunday",
  sun: "sunday",
  sonntag: "sunday",
  so: "sunday",
};

function parseWeekday(raw: unknown): Weekday | null {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return WEEKDAY_ALIASES[key] ?? null;
}

function parseHm(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const normalized = normalizeScheduleHHmm(s);
  return normalized ?? null;
}

function summarizeHoursPreview(
  preview: AssistantOpeningHoursPreview,
  locale: AppLocale,
): string {
  const house = preview.restaurant_name ? `${preview.restaurant_name}: ` : "";
  const parts: string[] = [];
  for (const day of preview.weekly_changes) {
    const label = weekdayLabelForLocale(day.weekday, locale, "long");
    if (day.closed) {
      parts.push(`${label} geschlossen`);
    } else {
      parts.push(`${label} ${day.opens_at}–${day.closes_at}`);
    }
  }
  for (const ex of preview.exception_changes) {
    if (ex.remove) {
      parts.push(`Ausnahme ${ex.date_ymd} entfernen`);
    } else if (ex.closed) {
      parts.push(`${ex.date_ymd} geschlossen`);
    } else {
      parts.push(`${ex.date_ymd} ${ex.opens_at}–${ex.closes_at}`);
    }
  }
  const detail = parts.length ? parts.join("; ") : "keine Änderung";
  if (locale === "de") {
    return `${house}Öffnungszeiten ändern — ${detail}.`;
  }
  return `${house}Update opening hours — ${detail}.`;
}

export async function toolUpdateOpeningHours(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return json({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const denied = await denyUnlessPermission(
    ctx,
    target.restaurantId,
    "settings.opening_hours",
    "Keine Berechtigung, Öffnungszeiten zu ändern.",
  );
  if (denied) return json({ ok: false, error: denied });

  const loaded = await loadOpeningHoursPayloadAdmin(target.sb, target.restaurantId);
  if ("error" in loaded) {
    return json({ ok: false, error: loaded.error });
  }

  const weeklyChanges: AssistantOpeningHoursDayChange[] = [];
  const nextWeekly: Record<Weekday, DayHours> = { ...loaded.weeklyHours };
  for (const day of WEEKDAY_ORDER) {
    nextWeekly[day] = { ...loaded.weeklyHours[day] };
  }

  const daysRaw = Array.isArray(args.days) ? args.days : [];
  for (const item of daysRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const weekday = parseWeekday(row.weekday ?? row.day);
    if (!weekday) {
      return json({
        ok: false,
        ask:
          locale === "de"
            ? "Welchen Wochentag meinst du?"
            : "Which weekday do you mean?",
      });
    }
    const closed =
      row.closed === true ||
      String(row.closed ?? "").toLowerCase() === "true" ||
      String(row.status ?? "").toLowerCase() === "closed";
    if (closed) {
      nextWeekly[weekday] = { closed: true };
      weeklyChanges.push({
        weekday,
        closed: true,
        opens_at: null,
        closes_at: null,
      });
      continue;
    }
    const opens = parseHm(row.opens_at ?? row.open ?? row.opens);
    const closes = parseHm(row.closes_at ?? row.close ?? row.closes);
    if (!opens || !closes) {
      return json({
        ok: false,
        ask:
          locale === "de"
            ? `Von wann bis wann soll ${weekdayLabelForLocale(weekday, locale, "long")} geöffnet sein?`
            : `What opening and closing time for ${weekdayLabelForLocale(weekday, locale, "long")}?`,
      });
    }
    nextWeekly[weekday] = { closed: false, open: opens, close: closes };
    weeklyChanges.push({
      weekday,
      closed: false,
      opens_at: opens,
      closes_at: closes,
    });
  }

  const exceptionChanges: AssistantOpeningHoursExceptionChange[] = [];
  let nextExceptions = [...loaded.dateExceptions];
  const exceptionsRaw = Array.isArray(args.exceptions) ? args.exceptions : [];
  for (const item of exceptionsRaw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const dateYmd = String(row.date_ymd ?? row.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
      return json({ ok: false, ask: assistantAsk(locale, "whichDate") });
    }
    const remove =
      row.remove === true || String(row.action ?? "").toLowerCase() === "remove";
    if (remove) {
      nextExceptions = nextExceptions.filter((ex) => ex.date !== dateYmd);
      exceptionChanges.push({
        date_ymd: dateYmd,
        closed: true,
        opens_at: null,
        closes_at: null,
        note: null,
        remove: true,
      });
      continue;
    }
    const closed =
      row.closed === true ||
      String(row.closed ?? "").toLowerCase() === "true" ||
      String(row.status ?? "").toLowerCase() === "closed";
    const note =
      row.note == null ? null : String(row.note).trim() || null;
    const existing = nextExceptions.find((ex) => ex.date === dateYmd);
    if (closed) {
      const next = {
        id: existing?.id ?? crypto.randomUUID(),
        date: dateYmd,
        closed: true as const,
        note: note ?? existing?.note,
      };
      nextExceptions = [
        ...nextExceptions.filter((ex) => ex.date !== dateYmd),
        next,
      ];
      exceptionChanges.push({
        date_ymd: dateYmd,
        closed: true,
        opens_at: null,
        closes_at: null,
        note: next.note ?? null,
      });
      continue;
    }
    const opens = parseHm(row.opens_at ?? row.open ?? row.opens);
    const closes = parseHm(row.closes_at ?? row.close ?? row.closes);
    if (!opens || !closes) {
      return json({
        ok: false,
        ask:
          locale === "de"
            ? `Von wann bis wann soll ${dateYmd} geöffnet sein?`
            : `What opening and closing time for ${dateYmd}?`,
      });
    }
    const next = {
      id: existing?.id ?? crypto.randomUUID(),
      date: dateYmd,
      closed: false as const,
      open: opens,
      close: closes,
      periods: [{ open: opens, close: closes }],
      note: note ?? existing?.note,
    };
    nextExceptions = [
      ...nextExceptions.filter((ex) => ex.date !== dateYmd),
      next,
    ];
    exceptionChanges.push({
      date_ymd: dateYmd,
      closed: false,
      opens_at: opens,
      closes_at: closes,
      note: next.note ?? null,
    });
  }

  if (!weeklyChanges.length && !exceptionChanges.length) {
    return json({
      ok: false,
      ask:
        locale === "de"
          ? "Welche Öffnungszeiten soll ich ändern (Wochentag oder Datum)?"
          : "Which opening hours should I change (weekday or date)?",
    });
  }

  const preview: AssistantOpeningHoursPreview = {
    restaurant_name: target.restaurantName,
    weekly_changes: weeklyChanges,
    exception_changes: exceptionChanges,
    next_weekly: nextWeekly,
    next_exceptions: nextExceptions.map((ex) => ({
      id: ex.id,
      date: ex.date,
      closed: ex.closed,
      open: ex.open,
      close: ex.close,
      note: ex.note,
    })),
    kitchenHoursEnabled: loaded.kitchenHoursEnabled,
    kitchenWeeklyHours: loaded.kitchenWeeklyHours,
  };

  if (!args.confirm) {
    return json({
      ok: true,
      status: "draft",
      preview,
      message: withConfirmQuestion(summarizeHoursPreview(preview, locale), locale),
    });
  }

  return persistOpeningHoursPreview(target.sb, target.restaurantId, preview, locale);
}

export async function persistOpeningHoursPreview(
  sb: AssistantToolContext["sb"],
  restaurantId: string,
  preview: AssistantOpeningHoursPreview,
  locale: AppLocale,
): Promise<string> {
  const saved = await replaceOpeningHoursWithClient(sb, restaurantId, {
    weeklyHours: preview.next_weekly,
    dateExceptions: preview.next_exceptions.map((ex) => ({
      id: ex.id,
      date: ex.date,
      closed: ex.closed,
      open: ex.open,
      close: ex.close,
      periods:
        ex.closed || !ex.open || !ex.close
          ? undefined
          : [{ open: ex.open, close: ex.close }],
      note: ex.note,
    })),
    kitchenHoursEnabled: preview.kitchenHoursEnabled,
    kitchenWeeklyHours: preview.kitchenWeeklyHours,
  });
  if (!saved.ok) {
    return json({ ok: false, error: saved.error });
  }

  return json({
    ok: true,
    status: "saved",
    preview,
    message:
      locale === "de"
        ? "Öffnungszeiten gespeichert."
        : "Opening hours saved.",
  });
}

export async function toolSyncPlatforms(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "write");
  if (target.kind === "ask") return json({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return json({ ok: false, ask: assistantAsk(locale, "noWriteAll") });
  }

  const scopeRaw = String(args.scope ?? args.target ?? "opening_hours")
    .trim()
    .toLowerCase();
  const wantHours =
    scopeRaw === "opening_hours" ||
    scopeRaw === "hours" ||
    scopeRaw === "öffnungszeiten" ||
    scopeRaw === "all" ||
    scopeRaw === "alle";
  const wantReviews =
    scopeRaw === "reviews" ||
    scopeRaw === "bewertungen" ||
    scopeRaw === "all" ||
    scopeRaw === "alle";

  if (!wantHours && !wantReviews) {
    return json({
      ok: false,
      ask:
        locale === "de"
          ? "Soll ich Öffnungszeiten (Google/Facebook) oder Bewertungen synchronisieren?"
          : "Should I sync opening hours (Google/Facebook) or reviews?",
    });
  }

  const platformsPreview = Array.isArray(args.platforms)
    ? args.platforms.map((p) => String(p))
    : ["google", "facebook"];
  if (!args.confirm) {
    return draftMutation({
      action: "sync_platforms",
      locale,
      message:
        locale === "de"
          ? `Plattformen synchronisieren (${scopeRaw}${wantHours ? `, ${platformsPreview.join("/")}` : ""})`
          : `Sync platforms (${scopeRaw}${wantHours ? `, ${platformsPreview.join("/")}` : ""})`,
      preview: {
        scope: scopeRaw,
        platforms: platformsPreview,
      },
    });
  }

  const results: Array<{ target: string; ok: boolean; error?: string; detail?: string }> =
    [];

  if (wantHours) {
    const hoursDenied = await denyUnlessPermission(
      ctx,
      target.restaurantId,
      "settings.opening_hours",
      "Keine Berechtigung für Öffnungszeiten-Sync.",
    );
    if (hoursDenied) return json({ ok: false, error: hoursDenied });

    const platformsRaw = Array.isArray(args.platforms)
      ? args.platforms.map((p) => String(p).toLowerCase())
      : ["google", "facebook"];
    const doGoogle =
      platformsRaw.length === 0 ||
      platformsRaw.some((p) => p.includes("google") || p === "all" || p === "alle");
    const doFacebook =
      platformsRaw.length === 0 ||
      platformsRaw.some((p) => p.includes("facebook") || p === "all" || p === "alle");

    if (doGoogle) {
      const gDenied = await denyUnlessPermission(
        ctx,
        target.restaurantId,
        "integrations.google_business",
        "Keine Berechtigung für Google Business.",
      );
      if (gDenied) {
        results.push({
          target: "opening_hours_google",
          ok: false,
          error: gDenied,
        });
      } else {
        const regular = await syncOpeningHoursToGoogleBusiness(
          target.restaurantId,
          "regular",
        );
        results.push({
          target: "opening_hours_google",
          ok: regular.ok,
          error: regular.ok ? undefined : regular.error,
        });
        if (regular.ok) {
          const exceptions = await syncOpeningHoursToGoogleBusiness(
            target.restaurantId,
            "exceptions",
          );
          results.push({
            target: "opening_exceptions_google",
            ok: exceptions.ok,
            error: exceptions.ok ? undefined : exceptions.error,
          });
        }
      }
    }

    if (doFacebook) {
      const fDenied = await denyUnlessPermission(
        ctx,
        target.restaurantId,
        "integrations.facebook",
        "Keine Berechtigung für Facebook.",
      );
      if (fDenied) {
        results.push({
          target: "opening_hours_facebook",
          ok: false,
          error: fDenied,
        });
      } else {
        const fb = await syncOpeningHoursToFacebook(target.restaurantId);
        results.push({
          target: "opening_hours_facebook",
          ok: fb.ok,
          error: fb.ok ? undefined : fb.error,
        });
      }
    }
  }

  if (wantReviews) {
    const revDenied = await denyUnlessModuleCrud(
      ctx,
      target.restaurantId,
      "reviews",
      "read",
      "Keine Berechtigung, Bewertungen zu synchronisieren.",
    );
    if (revDenied) {
      return json({ ok: false, error: revDenied });
    }
    const admin = createSupabaseAdminClient();
    if (!admin) {
      results.push({
        target: "reviews",
        ok: false,
        error: "server_misconfigured",
      });
    } else {
      const sync = await syncRestaurantReviewsPlatforms(admin, target.restaurantId);
      results.push({
        target: "reviews",
        ok: sync.errors.length === 0,
        detail: `synced=${sync.synced}`,
        error: sync.errors.length ? sync.errors.join("; ") : undefined,
      });
    }
  }

  const anyOk = results.some((r) => r.ok);
  return json({
    ok: anyOk,
    restaurant_name: target.restaurantName,
    results,
    message:
      locale === "de"
        ? anyOk
          ? "Plattform-Sync ausgeführt."
          : "Plattform-Sync fehlgeschlagen."
        : anyOk
          ? "Platform sync finished."
          : "Platform sync failed.",
  });
}
