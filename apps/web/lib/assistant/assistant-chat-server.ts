import "server-only";

import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import OpenAI from "openai";
import {
  toolCountReservations,
  toolCreateReservation,
  toolGetRestaurantRules,
  toolSearchHandbook,
  type AssistantToolContext,
} from "@/lib/assistant/assistant-tools";
import { fetchPlatformOpenaiConfigAdmin } from "@/lib/supabase/platform-openai-secrets-db";
import { runAssistantOfflineFallback } from "@/lib/assistant/assistant-offline-fallback";

export const ASSISTANT_TOOL_DEFINITIONS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  [
    {
      type: "function",
      function: {
        name: "count_reservations",
        description:
          "Zählt Reservierungen und Gäste in einem Datumsbereich (inkl. Start- und Endtag).",
        parameters: {
          type: "object",
          properties: {
            start_ymd: {
              type: "string",
              description: "Starttag YYYY-MM-DD (Restaurant-Zeitzone)",
            },
            end_ymd: {
              type: "string",
              description: "Endtag YYYY-MM-DD inklusiv",
            },
          },
          required: ["start_ymd", "end_ymd"],
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
        parameters: { type: "object", properties: {} },
      },
    },
    {
      type: "function",
      function: {
        name: "create_reservation",
        description:
          "Legt eine Reservierung an. Bei fehlenden Feldern nachfragen. Vor dem finalen Anlegen zuerst confirm=false (Entwurf), nach Nutzer-OK confirm=true.",
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
              description: "true erst nach ausdrücklicher Bestätigung des Nutzers",
            },
          },
          required: [
            "date_ymd",
            "time_hm",
            "party_size",
            "guest_first_name",
          ],
        },
      },
    },
  ];

async function runTool(
  ctx: AssistantToolContext,
  name: string,
  argsJson: string,
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ ok: false, error: "Ungültige Tool-Argumente." });
  }

  switch (name) {
    case "count_reservations":
      return toolCountReservations(ctx, {
        start_ymd: String(args.start_ymd ?? ""),
        end_ymd: String(args.end_ymd ?? ""),
      });
    case "search_handbook":
      return toolSearchHandbook(ctx, { query: String(args.query ?? "") });
    case "get_restaurant_rules":
      return toolGetRestaurantRules(ctx);
    case "create_reservation":
      return toolCreateReservation(ctx, {
        date_ymd: String(args.date_ymd ?? ""),
        time_hm: String(args.time_hm ?? ""),
        party_size: Number(args.party_size),
        guest_first_name: String(args.guest_first_name ?? ""),
        guest_last_name:
          args.guest_last_name == null ? null : String(args.guest_last_name),
        guest_phone:
          args.guest_phone == null ? null : String(args.guest_phone),
        notes: args.notes == null ? null : String(args.notes),
        confirm: Boolean(args.confirm),
      });
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
}): string {
  const today = todayYmdInTz(input.timeZone);
  return [
    "Du bist der Gwada-Assistent im Restaurant-Dashboard.",
    "Antworte auf Deutsch, kurz und klar.",
    "Nutze Tools für Fakten (Statistiken, Regeln, Handbuch, Aktionen) — erfinde keine Zahlen.",
    "Bei Aktionen fehlende Pflichtfelder nachfragen; vor dem Anlegen einer Reservierung confirm=false, dann nach OK confirm=true.",
    "Handbuch-Links als /docs/handbuch/<slug> nennen.",
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
    }
  | {
      ok: false;
      error: string;
      configured: boolean;
      status?: number;
    };

export async function runAssistantChatTurn(input: {
  ctx: AssistantToolContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  restaurantName: string | null;
  timeZone: string;
}): Promise<AssistantChatTurnResult> {
  const llm = await fetchPlatformOpenaiConfigAdmin();
  if (!llm.enabled || !llm.apiKey) {
    try {
      const reply = await runAssistantOfflineFallback({
        ctx: input.ctx,
        userMessage: input.userMessage,
        timeZone: input.timeZone,
        restaurantName: input.restaurantName,
      });
      return { ok: true, configured: false, mode: "offline", reply };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Offline-Assistent fehlgeschlagen.";
      console.warn("[assistant] offline", msg);
      return { ok: false, configured: false, status: 500, error: msg };
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
      }),
    },
    ...input.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

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
      return { ok: false, configured: true, status: 502, error: msg };
    }

    const choice = completion.choices[0]?.message;
    if (!choice) {
      return {
        ok: false,
        configured: true,
        status: 502,
        error: "Leere Modell-Antwort.",
      };
    }

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const reply = (choice.content ?? "").trim();
      if (!reply) {
        return {
          ok: false,
          configured: true,
          status: 502,
          error: "Leere Assistenten-Antwort.",
        };
      }
      return { ok: true, configured: true, mode: "llm", reply };
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
      );
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  return {
    ok: false,
    configured: true,
    status: 502,
    error: "Zu viele Tool-Schritte — bitte die Frage kürzer formulieren.",
  };
}
