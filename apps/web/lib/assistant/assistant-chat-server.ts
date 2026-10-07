import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import OpenAI from "openai";
import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import {
  askFromToolJson,
  pendingActionFromToolJson,
  settleAssistantToolPayloads,
  type AssistantPendingAction,
} from "@/lib/assistant/assistant-actions";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import {
  toolContentFeed,
  toolInboxSummary,
  toolPurchaseOrders,
  toolRestaurantStats,
  toolReviewsSummary,
  toolSearchContacts,
  toolSearchMenu,
  toolStaffShifts,
} from "@/lib/assistant/assistant-module-read-tools";
import {
  toolSendContactMessage,
  toolUpdateStaff,
  toolUpsertMenuItem,
} from "@/lib/assistant/assistant-entity-write-tools";
import {
  toolAdjustIngredientStock,
  toolSetMenuItemActive,
  toolSetPurchaseOrderStatus,
  toolUpdateReservation,
} from "@/lib/assistant/assistant-module-write-tools";
import { runAssistantOfflineFallback } from "@/lib/assistant/assistant-offline-fallback";
import {
  toolOpenAmounts,
  toolServiceToday,
  toolStaffOnShift,
  toolStock,
} from "@/lib/assistant/assistant-ops-tools";
import {
  toolSyncPlatforms,
  toolUpdateOpeningHours,
} from "@/lib/assistant/assistant-settings-tools";
import { ASSISTANT_TOOL_DEFINITIONS } from "@/lib/assistant/assistant-tool-definitions";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import {
  toolCountReservations,
  toolCreateReservation,
  toolGetRestaurantRules,
  toolSearchHandbook,
} from "@/lib/assistant/assistant-tools";

export { ASSISTANT_TOOL_DEFINITIONS };

const LOCALE_REPLY_HINT: Record<AppLocale, string> = {
  de: "Antworte auf Deutsch, freundlich, klar und in ganzen Sätzen — wie ein kompetenter Betriebsleiter-Assistent.",
  en: "Reply in English, warmly and clearly, like a capable restaurant ops assistant.",
  es: "Responde en español, de forma clara y amable.",
  fr: "Réponds en français, clairement et avec bienveillance.",
  it: "Rispondi in italiano, in modo chiaro e cordiale.",
  tr: "Kısa, net ve yardımcı bir şekilde Türkçe yanıt ver.",
  ar: "أجب بالعربية بوضوح وودية.",
  zh: "用简体中文清楚友好地回答。",
};

async function runTool(
  ctx: AssistantToolContext,
  name: string,
  argsJson: string,
  locale: AppLocale,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: "Ungültige Tool-Argumente." });
  }

  delete args.restaurant_id;
  delete args.restaurantId;

  switch (name) {
    case "count_reservations":
      return toolCountReservations(
        ctx,
        {
          start_ymd: args.start_ymd == null ? undefined : String(args.start_ymd),
          end_ymd: args.end_ymd == null ? undefined : String(args.end_ymd),
          date_ymd: args.date_ymd == null ? undefined : String(args.date_ymd),
          scope: args.scope == null ? undefined : String(args.scope),
          restaurant_name:
            args.restaurant_name == null ? undefined : String(args.restaurant_name),
        },
        normalizeAppLocale(locale),
      );
    case "search_handbook":
      return toolSearchHandbook(ctx, { query: String(args.query ?? "") });
    case "get_restaurant_rules":
      return toolGetRestaurantRules(ctx, {
        locale,
        scope: args.scope == null ? undefined : String(args.scope),
        restaurant_name:
          args.restaurant_name == null ? undefined : String(args.restaurant_name),
      });
    case "create_reservation":
      return toolCreateReservation(
        ctx,
        {
          date_ymd: String(args.date_ymd ?? ""),
          time_hm: String(args.time_hm ?? ""),
          party_size: Number(args.party_size),
          guest_first_name: String(args.guest_first_name ?? ""),
          guest_last_name:
            args.guest_last_name == null ? null : String(args.guest_last_name),
          guest_phone: args.guest_phone == null ? null : String(args.guest_phone),
          notes: args.notes == null ? null : String(args.notes),
          confirm: false,
          scope: args.scope == null ? undefined : String(args.scope),
          restaurant_name:
            args.restaurant_name == null ? undefined : String(args.restaurant_name),
        },
        locale,
      );
    case "update_reservation":
      return toolUpdateReservation(ctx, { ...args, confirm: false }, locale);
    case "service_today":
      return toolServiceToday(ctx, args, locale);
    case "stock":
      return toolStock(ctx, args, locale);
    case "adjust_ingredient_stock":
      return toolAdjustIngredientStock(ctx, { ...args, confirm: false }, locale);
    case "staff_on_shift":
      return toolStaffOnShift(ctx, args, locale);
    case "staff_shifts":
      return toolStaffShifts(ctx, args, locale);
    case "open_amounts":
      return toolOpenAmounts(ctx, args, locale);
    case "update_opening_hours":
      return toolUpdateOpeningHours(ctx, { ...args, confirm: false }, locale);
    case "sync_platforms":
      return toolSyncPlatforms(ctx, { ...args, confirm: false }, locale);
    case "search_menu":
      return toolSearchMenu(ctx, args, locale);
    case "set_menu_item_active":
      return toolSetMenuItemActive(ctx, { ...args, confirm: false }, locale);
    case "upsert_menu_item":
      return toolUpsertMenuItem(ctx, { ...args, confirm: false }, locale);
    case "update_staff":
      return toolUpdateStaff(ctx, { ...args, confirm: false }, locale);
    case "send_contact_message":
      return toolSendContactMessage(ctx, { ...args, confirm: false }, locale);
    case "purchase_orders":
      return toolPurchaseOrders(ctx, args, locale);
    case "set_purchase_order_status":
      return toolSetPurchaseOrderStatus(ctx, { ...args, confirm: false }, locale);
    case "search_contacts":
      return toolSearchContacts(ctx, args, locale);
    case "inbox_summary":
      return toolInboxSummary(ctx, args, locale);
    case "reviews_summary":
      return toolReviewsSummary(ctx, args, locale);
    case "content_feed":
      return toolContentFeed(ctx, args, locale);
    case "restaurant_stats":
      return toolRestaurantStats(ctx, args, locale);
    default:
      return JSON.stringify({ ok: false, error: `Unbekanntes Tool: ${name}` });
  }
}

function todayYmdInTz(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function buildSystemPrompt(input: {
  restaurantName: string | null;
  timeZone: string;
  locale: AppLocale;
}): string {
  const today = todayYmdInTz(input.timeZone);
  return [
    "Du bist der Gwada-Restaurant-Assistent: ein fähiger Betriebshelfer für genau dieses Haus.",
    LOCALE_REPLY_HINT[input.locale],
    "Nutze Tools für Fakten — erfinde keine Zahlen, Status oder Datensätze.",
    "Du hast dieselben Modulrechte wie der angemeldete Nutzer. Bei forbidden/Keine Berechtigung: klar sagen, nicht umgehen.",
    "Lies über Tools: Zählungen, höchstens acht Zeilen oder ein Treffer. Keine ganze Tabelle verlangen.",
    "Ohne genannten Zeitraum gilt heute. Kein Datum raten.",
    "Wenn ein Tool ask liefert: antworte nur mit dieser einen kurzen Frage und warte.",
    "Schreib-/Sync-/Sende-Tools immer mit confirm=false. Die UI zeigt Kurzfassung + „Jetzt umsetzen?“ — nie still speichern oder senden.",
    "Du kannst u. a.: Reservierungen lesen/anlegen/Status/Storno; Öffnungszeiten; Plattform-Sync; Speisekarte suchen, aktiv/inaktiv, Gerichte anlegen/ändern inkl. Rezept; Bestand/Bestellungen; Mitarbeiter lesen/ändern und Schichten; Kontakte, Inbox, Nachrichten senden; Bewertungen; News/Events-Zähler (nicht publizieren); offene Rechnungen; Statistiken; Handbuch.",
    "Noch nicht möglich (ehrlich sagen): News/Events/Galerie publizieren (Bilder), Integrationen verbinden (OAuth), Display-Geräte, Buchhaltung Belege anlegen/senden, Verträge/Rechte, Optionsgruppen/Bilder an Gerichten, Superadmin-Plattformdaten mit Restaurant-Key.",
    "Nur das Sitzungs-Restaurant. restaurant_id nie selbst setzen.",
    "Im Superadmin: scope=all nur für Summen, restaurant_name nur wenn genannt.",
    "Wochentage: weekday_label aus Tool-Daten, nie monday/tuesday als Text.",
    "Handbuch-Links: /docs/handbook/<slug>.",
    `UI-Locale: ${input.locale}`,
    `Restaurant: ${input.restaurantName ?? "unbekannt"}`,
    `Zeitzone: ${input.timeZone}`,
    `Heute (Restaurant): ${today}`,
  ].join("\n");
}

export type AssistantChatTurnResult =
  | {
      ok: true;
      reply: string;
      configured: boolean;
      mode: "llm" | "offline";
      pendingAction: AssistantPendingAction | null;
    }
  | {
      ok: false;
      error: string;
      configured: boolean;
      status?: number;
      pendingAction: null;
    };

export async function runAssistantChatTurn(input: {
  ctx: AssistantToolContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  restaurantName: string | null;
  timeZone: string;
  locale?: AppLocale | string | null;
  llm: AssistantLlmRuntime | null;
  keyAudience: "restaurant" | "superadmin";
}): Promise<AssistantChatTurnResult> {
  const locale = normalizeAppLocale(input.locale ?? DEFAULT_APP_LOCALE);
  const llm = input.llm;
  if (!llm?.apiKey) {
    try {
      const reply = await runAssistantOfflineFallback({
        ctx: input.ctx,
        userMessage: input.userMessage,
        timeZone: input.timeZone,
        restaurantName: input.restaurantName,
        locale,
        keyAudience: input.keyAudience,
      });
      return { ok: true, configured: false, mode: "offline", reply, pendingAction: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Offline-Assistent fehlgeschlagen.";
      console.warn("[assistant] offline", msg);
      return { ok: false, configured: false, status: 500, error: msg, pendingAction: null };
    }
  }

  const client = new OpenAI({
    apiKey: llm.apiKey,
    ...(llm.baseURL ? { baseURL: llm.baseURL } : {}),
  });
  const providerLabel = llm.provider === "grok" ? "Grok" : "OpenAI";
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        restaurantName: input.restaurantName,
        timeZone: input.timeZone,
        locale,
      }),
    },
    ...input.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const toolPayloads: string[] = [];

  for (let step = 0; step < 6; step++) {
    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await client.chat.completions.create({
        model: llm.model,
        messages,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.4,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${providerLabel}-Fehler`;
      console.warn("[assistant] llm", llm.provider, msg);
      return { ok: false, configured: true, status: 502, error: msg, pendingAction: null };
    }

    const choice = completion.choices[0]?.message;
    if (!choice) {
      return {
        ok: false,
        configured: true,
        status: 502,
        error: "Leere Modell-Antwort.",
        pendingAction: null,
      };
    }

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const reply = (choice.content ?? "").trim();
      const settled = settleAssistantToolPayloads(reply, toolPayloads);
      if (!settled.reply) {
        return {
          ok: false,
          configured: true,
          status: 502,
          error: "Leere Assistenten-Antwort.",
          pendingAction: null,
        };
      }
      return { ok: true, configured: true, mode: "llm", ...settled };
    }

    messages.push({
      role: "assistant",
      content: choice.content,
      tool_calls: toolCalls,
    });

    const functionCalls = toolCalls.filter(
      (call): call is Extract<typeof call, { type: "function" }> =>
        call.type === "function",
    );
    const results = await Promise.all(
      functionCalls.map((call) =>
        runTool(
          input.ctx,
          call.function.name,
          call.function.arguments,
          locale,
        ),
      ),
    );
    for (let i = 0; i < functionCalls.length; i++) {
      const result = results[i]!;
      toolPayloads.push(result);
      messages.push({
        role: "tool",
        tool_call_id: functionCalls[i]!.id,
        content: result,
      });
    }

    if (
      toolPayloads.some((raw) => askFromToolJson(raw) || pendingActionFromToolJson(raw))
    ) {
      const settled = settleAssistantToolPayloads("", toolPayloads);
      if (settled.reply) {
        return { ok: true, configured: true, mode: "llm", ...settled };
      }
    }
  }

  return {
    ok: false,
    configured: true,
    status: 502,
    error: "Zu viele Tool-Schritte — bitte die Frage kürzer formulieren.",
    pendingAction: null,
  };
}
