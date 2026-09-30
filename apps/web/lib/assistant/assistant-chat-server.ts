import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import OpenAI from "openai";
import {
  DEFAULT_APP_LOCALE,
  normalizeAppLocale,
  type AppLocale,
} from "@/i18n/config";
import {
  toolCountReservations,
  toolCreateReservation,
  toolGetRestaurantRules,
  toolSearchHandbook,
  type AssistantToolContext,
} from "@/lib/assistant/assistant-tools";
import {
  askFromToolJson,
  pendingActionFromToolJson,
  settleAssistantToolPayloads,
  type AssistantPendingAction,
} from "@/lib/assistant/assistant-actions";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import {
  toolOpenAmounts,
  toolServiceToday,
  toolStaffOnShift,
  toolStock,
} from "@/lib/assistant/assistant-ops-tools";
import { runAssistantOfflineFallback } from "@/lib/assistant/assistant-offline-fallback";

const LOCALE_REPLY_HINT: Record<AppLocale, string> = {
  de: "Antworte auf Deutsch, kurz und klar.",
  en: "Reply in English, briefly and clearly.",
  es: "Responde en español, de forma breve y clara.",
  fr: "Réponds en français, de façon courte et claire.",
  it: "Rispondi in italiano, in modo breve e chiaro.",
  tr: "Kısa ve net bir şekilde Türkçe yanıt ver.",
  ar: "أجب بالعربية باختصار ووضوح.",
  zh: "用简体中文简短清楚地回答。",
};

export const ASSISTANT_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: "function",
      function: {
        name: "count_reservations",
        description:
          "Zählt Reservierungen und Gäste. Ohne Datum gilt heute in der Restaurant-Zeitzone. Keine Gästeliste.",
        parameters: {
          type: "object",
          properties: {
            start_ymd: { type: "string", description: "Starttag YYYY-MM-DD, nur wenn der Nutzer Tage nennt" },
            end_ymd: { type: "string", description: "Endtag YYYY-MM-DD inklusiv, nur wenn genannt" },
            date_ymd: { type: "string", description: "Ein Tag YYYY-MM-DD, nur wenn genannt" },
            scope: { type: "string", description: "Nur Superadmin: all, sonst weglassen" },
            restaurant_name: { type: "string", description: "Nur Superadmin, wenn ein Haus genannt wurde" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "search_handbook",
        description:
          "Durchsucht das Gwada-Benutzerhandbuch und liefert Erklärungen zu App-Funktionen.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Suchbegriff oder Frage, z. B. Sonderöffnungszeiten",
            },
          },
          required: ["query"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_restaurant_rules",
        description:
          "Lädt Öffnungszeiten, Sonderregeln und Reservierungs-Einstellungen des aktuellen Restaurants.",
        parameters: {
          type: "object",
          properties: {
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "service_today",
        description:
          "Heutiger Service: Zählung, kurze Liste (höchstens 8) oder ein Gast per Name. Ohne Datum = heute. Keine ganze Tabelle.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", description: "count, list oder one" },
            date_ymd: { type: "string" },
            guest_name: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "stock",
        description:
          "Bestand: Zahl leerer Zutaten und offener Bestellungen, kurze Liste oder eine Zutat per Name. Kein kompletter Katalog.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", description: "count, list oder one" },
            name: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "staff_on_shift",
        description:
          "Wer gerade eingestempelt ist: Zahl, kurze Liste oder eine Person per Name. Keine Personalakte.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", description: "count, list oder one" },
            name: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "open_amounts",
        description:
          "Offene und überfällige Rechnungsbeträge: Summe und Anzahl, kurze Liste oder ein Beleg per Nummer oder Titel. Keine Belegliste des ganzen Hauses, wenn nur die Summe gefragt ist.",
        parameters: {
          type: "object",
          properties: {
            mode: { type: "string", description: "count, list oder one" },
            name: { type: "string" },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_reservation",
        description:
          "Legt eine Reservierung an. Fehlendes Datum, Uhrzeit, Personenzahl oder Name: Tool ohne geratenen Wert aufrufen, damit ask zurückkommt. confirm immer false. Die Oberfläche bestätigt.",
        parameters: {
          type: "object",
          properties: {
            date_ymd: { type: "string", description: "YYYY-MM-DD" },
            time_hm: { type: "string", description: "HH:MM lokal" },
            party_size: { type: "integer", minimum: 1 },
            guest_first_name: { type: "string" },
            guest_last_name: { type: "string" },
            guest_phone: { type: "string" },
            notes: { type: "string" },
            confirm: {
              type: "boolean",
              description: "Immer false. Die Oberfläche speichert nach dem Dialog.",
            },
            scope: { type: "string" },
            restaurant_name: { type: "string" },
          },
        },
      },
    },
  ];

async function runTool(
  ctx: AssistantToolContext,
  name: string,
  argsJson: string,
  locale: string,
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
          guest_phone:
            args.guest_phone == null ? null : String(args.guest_phone),
          notes: args.notes == null ? null : String(args.notes),
          confirm: false,
          scope: args.scope == null ? undefined : String(args.scope),
          restaurant_name:
            args.restaurant_name == null ? undefined : String(args.restaurant_name),
        },
        locale,
      );
    case "service_today":
      return toolServiceToday(ctx, args, locale);
    case "stock":
      return toolStock(ctx, args, locale);
    case "staff_on_shift":
      return toolStaffOnShift(ctx, args, locale);
    case "open_amounts":
      return toolOpenAmounts(ctx, args, locale);
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
    "Du bist der Gwada-Assistent im Restaurant-Dashboard.",
    LOCALE_REPLY_HINT[input.locale],
    "Nutze Tools für Fakten — erfinde keine Zahlen und keine Datensätze.",
    "Lies nur über die Tools. Sie liefern Zählungen, höchstens acht Zeilen oder einen Treffer. Verlange keine ganze Tabelle.",
    "Ohne genannten Zeitraum gilt heute. Ein Datum, das der Nutzer nicht gesagt hat, nicht einsetzen.",
    "Wenn ein Tool ask liefert: antworte nur mit dieser einen kurzen Frage und warte. Rate nicht Tag, Gast, Gericht, Betrag oder welchen Datensatz.",
    "Schreib-Tools immer mit confirm=false. Nichts ist gespeichert, bevor die Oberfläche den Entwurf bestätigt.",
    "Ein Restaurant betrifft nur das Haus der Sitzung. restaurant_id nie selbst setzen.",
    "Im Superadmin: scope=all nur für Summen über alle Häuser, restaurant_name nur wenn ein Haus genannt wurde. Unklar welches Haus: eine Frage.",
    "Bei Wochentagen immer weekday_label aus den Tool-Daten verwenden.",
    "Handbuch-Links als /docs/handbuch/<slug> nennen.",
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
        temperature: 0.3,
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

    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      const result = await runTool(
        input.ctx,
        call.function.name,
        call.function.arguments,
        locale,
      );
      toolPayloads.push(result);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
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

