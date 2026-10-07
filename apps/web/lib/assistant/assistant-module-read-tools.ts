import "server-only";

import { ASSISTANT_LIST_CAP, assistantAsk } from "@/lib/assistant/assistant-ask";
import { resolveAssistantTarget } from "@/lib/assistant/assistant-scope";
import {
  assistantJson,
  denyUnlessModuleCrud,
} from "@/lib/assistant/assistant-tool-auth";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { reservationRangeIso } from "@/lib/assistant/assistant-tools";
import {
  parseInsightsPeriodDays,
  type InsightsPeriodDays,
} from "@/lib/insights/insights-date-range";
import { fetchInsightsOverview } from "@/lib/insights/insights-overview-server";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import { restaurantTodayYmd } from "@/lib/restaurant/restaurant-timezone";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";

async function todayYmd(sb: SupabaseClient, restaurantId: string): Promise<string> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, restaurantId);
  return restaurantTodayYmd(timeZone);
}

function hmInTz(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

export async function toolSearchMenu(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "menu",
    "read",
    "Keine Berechtigung für die Speisekarte.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? args.query ?? "").trim();
  const mode = String(args.mode ?? (name ? "one" : "count"));
  const onlyActive = args.only_active !== false;

  let base = target.sb
    .from("menu_items")
    .select("id, name, price, is_active, category_id", {
      count: "exact",
    })
    .eq("restaurant_id", target.restaurantId);
  if (onlyActive) base = base.eq("is_active", true);

  if (mode === "one" || mode === "list") {
    if (mode === "one" && !name) {
      return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
    }
    if (name) {
      const q = name.replace(/[%_,]/g, "");
      base = base.ilike("name", `%${q}%`);
    }
    const { data, error, count } = await base
      .order("name")
      .limit(mode === "one" ? 6 : ASSISTANT_LIST_CAP);
    if (error) return assistantJson({ ok: false, error: error.message });
    const categoryIds = [
      ...new Set(
        (data ?? [])
          .map((row) => row.category_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];
    const categoryNames = new Map<string, string>();
    if (categoryIds.length) {
      const { data: cats } = await target.sb
        .from("menu_categories")
        .select("id, name")
        .eq("restaurant_id", target.restaurantId)
        .in("id", categoryIds);
      for (const cat of cats ?? []) {
        categoryNames.set(cat.id as string, String(cat.name));
      }
    }
    const rows = (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      price: row.price,
      active: row.is_active !== false,
      category:
        typeof row.category_id === "string"
          ? categoryNames.get(row.category_id) ?? null
          : null,
    }));
    if (mode === "one") {
      if (rows.length === 0) {
        return assistantJson({ ok: false, ask: assistantAsk(locale, "dish") });
      }
      if (rows.length > 1) {
        return assistantJson({
          ok: false,
          ask: `${assistantAsk(locale, "dish")} ${rows.map((r) => r.name).join(", ")}`,
        });
      }
      return assistantJson({ ok: true, match: rows[0] });
    }
    return assistantJson({
      ok: true,
      restaurant_name: target.restaurantName,
      total: count ?? rows.length,
      list_capped: (count ?? 0) > ASSISTANT_LIST_CAP,
      rows,
    });
  }

  const { count, error } = await base;
  if (error) return assistantJson({ ok: false, error: error.message });
  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    active_only: onlyActive,
    item_count: count ?? 0,
  });
}

export async function toolRestaurantStats(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "insights",
    "read",
    "Keine Berechtigung für Statistiken.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const periodDays = parseInsightsPeriodDays(
    args.period_days == null ? "30" : String(args.period_days),
  ) as InsightsPeriodDays;
  const startYmd =
    typeof args.start_ymd === "string" ? args.start_ymd.trim() : "";
  const endYmd = typeof args.end_ymd === "string" ? args.end_ymd.trim() : "";
  const rangeParams =
    startYmd && endYmd
      ? { startYmd, endYmd }
      : { periodDays };

  const result = await fetchInsightsOverview(
    target.sb,
    target.restaurantId,
    rangeParams,
  );
  if ("error" in result) {
    return assistantJson({ ok: false, error: result.error });
  }

  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    period_start: result.periodStartYmd,
    period_end: result.periodEndYmd,
    gwada: result.gwada,
    platforms: (result.platforms ?? []).map((card) => ({
      id: card.id,
      label: card.label,
      connected: card.connected,
      insights_available: card.insightsAvailable,
      metrics: card.metrics,
    })),
  });
}

export async function toolSearchContacts(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "contacts",
    "read",
    "Keine Berechtigung für Kontakte.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const name = String(args.name ?? args.query ?? "").trim();
  const mode = String(args.mode ?? (name ? "one" : "count"));

  if (mode === "count" && !name) {
    const { count, error } = await target.sb
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", target.restaurantId);
    if (error) return assistantJson({ ok: false, error: error.message });
    return assistantJson({
      ok: true,
      restaurant_name: target.restaurantName,
      contact_count: count ?? 0,
    });
  }

  if (!name) {
    return assistantJson({
      ok: false,
      ask: locale === "de" ? "Welchen Kontakt meinst du?" : "Which contact?",
    });
  }
  const q = name.replace(/[%_,]/g, "");
  const { data, error } = await target.sb
    .from("contacts")
    .select(
      "id, first_name, last_name, company, contact_emails(email, is_primary), contact_phones(phone_display, is_primary)",
    )
    .eq("restaurant_id", target.restaurantId)
    .or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`,
    )
    .order("updated_at", { ascending: false })
    .limit(mode === "one" ? 6 : ASSISTANT_LIST_CAP);
  if (error) return assistantJson({ ok: false, error: error.message });
  const rows = (data ?? []).map((row) => {
    const emails = Array.isArray(row.contact_emails) ? row.contact_emails : [];
    const phones = Array.isArray(row.contact_phones) ? row.contact_phones : [];
    const primaryEmail =
      emails.find((e) => e && typeof e === "object" && "is_primary" in e && e.is_primary) ??
      emails[0];
    const primaryPhone =
      phones.find((p) => p && typeof p === "object" && "is_primary" in p && p.is_primary) ??
      phones[0];
    return {
      id: row.id,
      name:
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        row.company ||
        "?",
      email:
        primaryEmail && typeof primaryEmail === "object" && "email" in primaryEmail
          ? String(primaryEmail.email)
          : null,
      phone:
        primaryPhone &&
        typeof primaryPhone === "object" &&
        "phone_display" in primaryPhone
          ? String(primaryPhone.phone_display)
          : null,
      company: row.company,
    };
  });
  if (mode === "one") {
    if (rows.length === 0) {
      return assistantJson({
        ok: false,
        ask: locale === "de" ? "Welchen Kontakt meinst du?" : "Which contact?",
      });
    }
    if (rows.length > 1) {
      return assistantJson({
        ok: false,
        ask: `${locale === "de" ? "Welchen Kontakt meinst du?" : "Which contact?"} ${rows.map((r) => r.name).join(", ")}`,
      });
    }
    return assistantJson({ ok: true, match: rows[0] });
  }
  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    rows,
  });
}

export async function toolReviewsSummary(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "reviews",
    "read",
    "Keine Berechtigung für Bewertungen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const { data: syncRows, error: syncErr } = await target.sb
    .from("restaurant_reviews_platform_sync")
    .select("platform, item_count, synced_at, last_error, meta")
    .eq("restaurant_id", target.restaurantId);
  if (syncErr) return assistantJson({ ok: false, error: syncErr.message });

  const { count: gwadaCount, error: gwadaErr } = await target.sb
    .from("gwada_reviews")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", target.restaurantId);
  if (gwadaErr) return assistantJson({ ok: false, error: gwadaErr.message });

  const { data: recent, error: recentErr } = await target.sb
    .from("restaurant_reviews_platform_cache")
    .select("platform, item, created_at")
    .eq("restaurant_id", target.restaurantId)
    .order("created_at", { ascending: false })
    .limit(ASSISTANT_LIST_CAP);

  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    gwada_review_count: gwadaCount ?? 0,
    platforms: (syncRows ?? []).map((row) => {
      const meta =
        row.meta && typeof row.meta === "object"
          ? (row.meta as Record<string, unknown>)
          : {};
      return {
        platform: row.platform,
        item_count: row.item_count,
        total_review_count:
          typeof meta.totalReviewCount === "number"
            ? meta.totalReviewCount
            : null,
        average_rating:
          typeof meta.averageRating === "number" ? meta.averageRating : null,
        synced_at: row.synced_at,
        last_error: row.last_error,
      };
    }),
    recent: recentErr
      ? []
      : (recent ?? []).map((row) => {
          const item =
            row.item && typeof row.item === "object"
              ? (row.item as Record<string, unknown>)
              : {};
          return {
            platform: row.platform,
            rating: typeof item.rating === "number" ? item.rating : null,
            author:
              typeof item.authorName === "string"
                ? item.authorName
                : typeof item.author === "string"
                  ? item.author
                  : null,
            created_at: row.created_at,
            comment:
              typeof item.comment === "string"
                ? item.comment.slice(0, 160)
                : typeof item.text === "string"
                  ? item.text.slice(0, 160)
                  : null,
          };
        }),
  });
}

export async function toolContentFeed(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }

  const kind = String(args.kind ?? "all").toLowerCase();
  const wantNews = kind === "news" || kind === "all" || kind === "alle";
  const wantEvents = kind === "events" || kind === "all" || kind === "alle";
  const out: Record<string, unknown> = {
    ok: true,
    restaurant_name: target.restaurantName,
  };

  if (wantNews) {
    const denied = await denyUnlessModuleCrud(
      ctx,
      target.restaurantId,
      "news",
      "read",
      "Keine Berechtigung für News.",
    );
    if (denied) out.news = { ok: false, error: denied };
    else {
      const [{ count, error }, { data: sync }] = await Promise.all([
        target.sb
          .from("gwada_news_posts")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", target.restaurantId),
        target.sb
          .from("restaurant_news_platform_sync")
          .select("platform, item_count, synced_at, last_error")
          .eq("restaurant_id", target.restaurantId),
      ]);
      if (error) out.news = { ok: false, error: error.message };
      else {
        out.news = {
          ok: true,
          post_count: count ?? 0,
          platforms: sync ?? [],
        };
      }
    }
  }

  if (wantEvents) {
    const denied = await denyUnlessModuleCrud(
      ctx,
      target.restaurantId,
      "events",
      "read",
      "Keine Berechtigung für Events.",
    );
    if (denied) out.events = { ok: false, error: denied };
    else {
      const [{ count, error }, { data: sync }] = await Promise.all([
        target.sb
          .from("gwada_events")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", target.restaurantId),
        target.sb
          .from("restaurant_events_platform_sync")
          .select("platform, item_count, synced_at, last_error")
          .eq("restaurant_id", target.restaurantId),
      ]);
      if (error) out.events = { ok: false, error: error.message };
      else {
        out.events = {
          ok: true,
          event_count: count ?? 0,
          platforms: sync ?? [],
        };
      }
    }
  }

  return assistantJson(out);
}

export async function toolStaffShifts(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "staff",
    "read",
    "Keine Berechtigung für den Schichtplan.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const today = await todayYmd(ctx.sb, target.restaurantId);
  const dateYmd =
    typeof args.date_ymd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date_ymd)
      ? args.date_ymd
      : today;
  const bounds = await reservationRangeIso(
    ctx.sb,
    target.restaurantId,
    dateYmd,
    dateYmd,
  );
  if ("error" in bounds) {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichDate") });
  }

  const { data, error, count } = await target.sb
    .from("restaurant_staff_scheduled_shifts")
    .select("id, staff_id, starts_at, ends_at, status, label", {
      count: "exact",
    })
    .eq("restaurant_id", target.restaurantId)
    .gte("starts_at", bounds.startIso)
    .lt("starts_at", bounds.endIso)
    .neq("status", "declined")
    .order("starts_at", { ascending: true })
    .limit(ASSISTANT_LIST_CAP);
  if (error) return assistantJson({ ok: false, error: error.message });

  const staffIds = [
    ...new Set(
      (data ?? [])
        .map((row) => row.staff_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
  const nameById = new Map<string, string>();
  if (staffIds.length) {
    const { data: people } = await target.sb
      .from("restaurant_staff")
      .select("id, given_name, family_name")
      .eq("restaurant_id", target.restaurantId)
      .in("id", staffIds);
    for (const person of people ?? []) {
      nameById.set(
        person.id as string,
        `${person.given_name ?? ""} ${person.family_name ?? ""}`.trim(),
      );
    }
  }

  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    date_ymd: dateYmd,
    shift_count: count ?? 0,
    list_capped: (count ?? 0) > ASSISTANT_LIST_CAP,
    rows: (data ?? []).map((row) => ({
      name:
        (typeof row.staff_id === "string" && nameById.get(row.staff_id)) ||
        (typeof row.label === "string" ? row.label : "") ||
        "",
      start: hmInTz(String(row.starts_at), bounds.timeZone),
      end: hmInTz(String(row.ends_at), bounds.timeZone),
      status: row.status,
    })),
  });
}

export async function toolPurchaseOrders(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "inventory",
    "read",
    "Keine Berechtigung für Bestellungen.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const statusFilter = String(args.status ?? "open").toLowerCase();
  const statuses =
    statusFilter === "all" || statusFilter === "alle"
      ? null
      : statusFilter === "open"
        ? ["open", "ordered"]
        : [statusFilter];

  let query = target.sb
    .from("inventory_purchase_orders")
    .select("id, status, supplier_id, supplier_name, delivery_date", {
      count: "exact",
    })
    .eq("restaurant_id", target.restaurantId)
    .order("created_at", { ascending: false })
    .limit(ASSISTANT_LIST_CAP);
  if (statuses) query = query.in("status", statuses);

  const { data, error, count } = await query;
  if (error) return assistantJson({ ok: false, error: error.message });

  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    status_filter: statusFilter,
    order_count: count ?? 0,
    list_capped: (count ?? 0) > ASSISTANT_LIST_CAP,
    rows: (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      delivery_date: row.delivery_date,
      supplier:
        typeof row.supplier_name === "string" && row.supplier_name.trim()
          ? row.supplier_name
          : null,
    })),
  });
}

export async function toolInboxSummary(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
): Promise<string> {
  const target = await resolveAssistantTarget(ctx, args, locale, "read");
  if (target.kind === "ask") return assistantJson({ ok: false, ask: target.ask });
  if (target.kind !== "one") {
    return assistantJson({ ok: false, ask: assistantAsk(locale, "whichRestaurant") });
  }
  const denied = await denyUnlessModuleCrud(
    ctx,
    target.restaurantId,
    "contacts",
    "read",
    "Keine Berechtigung für Nachrichten.",
  );
  if (denied) return assistantJson({ ok: false, error: denied });

  const { count: inbound, error: inErr } = await target.sb
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", target.restaurantId)
    .eq("direction", "inbound");
  if (inErr) return assistantJson({ ok: false, error: inErr.message });

  const { count: recent7d, error: recentErr } = await target.sb
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", target.restaurantId)
    .eq("direction", "inbound")
    .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());
  if (recentErr) {
    return assistantJson({
      ok: true,
      restaurant_name: target.restaurantName,
      inbound_count: inbound ?? 0,
    });
  }
  return assistantJson({
    ok: true,
    restaurant_name: target.restaurantName,
    inbound_count: inbound ?? 0,
    inbound_last_7_days: recent7d ?? 0,
  });
}
