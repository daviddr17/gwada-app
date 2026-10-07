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
  ASSISTANT_MAX_TOOL_ROUNDS,
  clipAssistantHistory,
} from "@/lib/assistant/assistant-chat-limits";
import type { AssistantSseEvent } from "@/lib/assistant/assistant-chat-sse";
import {
  accumulateStreamToolCallDelta,
  type AssistantStreamToolAcc,
} from "@/lib/assistant/assistant-stream-tool-acc";
import { runAssistantOfflineFallback } from "@/lib/assistant/assistant-offline-fallback";
import { ASSISTANT_TOOL_DEFINITIONS } from "@/lib/assistant/assistant-tool-definitions";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { runAssistantToolByName } from "@/lib/assistant/assistant-tool-dispatch";

export { accumulateStreamToolCallDelta } from "@/lib/assistant/assistant-stream-tool-acc";

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

const LOCALE_REPLY_HINT: Record<AppLocale, string> = {
  de: "Sprich natürliches Deutsch: kurz, freundlich, wie ein erfahrener Betriebsleiter im Gasthaus — keine Roboterlisten, kein JSON.",
  en: "Speak naturally and briefly, like an experienced restaurant manager — no robot lists, no JSON.",
  es: "Habla de forma natural y breve, como un gerente de restaurante — sin listas robóticas ni JSON.",
  fr: "Parle naturellement et brièvement, comme un responsable de restaurant — pas de listes robotiques ni de JSON.",
  it: "Parla in modo naturale e breve, come un responsabile di ristorante — niente elenchi robotici né JSON.",
  tr: "Doğal ve kısa konuş; restoran müdürü gibi — robot listesi veya JSON yok.",
  ar: "تحدّث بطبيعية وإيجاز كمدير مطعم — بلا قوائم آلية أو JSON.",
  zh: "用自然简短的话回答，像餐厅经理一样——不要机器列表或 JSON。",
};

function buildSystemPrompt(input: {
  restaurantName: string | null;
  timeZone: string;
  locale: AppLocale;
}): string {
  const today = todayYmdInTz(input.timeZone);
  const house = input.restaurantName?.trim() || "dieses Restaurant";
  return [
    `Du bist der Gwada-Assistent für ${house}: hilfst im Tagesgeschäft, wie ein ruhiger, kompetenter Kollege.`,
    LOCALE_REPLY_HINT[input.locale],
    "Gespräch: Erst die Frage verstehen, dann antworten. Bei Smalltalk oder „Wie geht’s?“ kurz menschlich antworten — nicht sofort Tools erzwingen.",
    "Fakten nur aus Tools (Zahlen, Zeiten, Namen, Status). Tool-Ergebnisse in klaren Sätzen zusammenfassen — keine Roh-JSON, keine Bullet-Wüste.",
    "Rechte wie der angemeldete Nutzer. Bei „Keine Berechtigung“: freundlich sagen, was fehlt — nicht umgehen.",
    "Lesen: höchstens kurze Listen (≤8) oder ein Treffer. Ohne Zeitraum = heute. Kein Datum raten.",
    "Wenn ein Tool `ask` liefert: genau diese eine Rückfrage stellen und warten.",
    "Schreiben/Sync/Senden: immer confirm=false. Die App fragt „Jetzt umsetzen?“ — nie still speichern oder senden.",
    "Kannst du: Reservierungen, Öffnungszeiten, Plattform-Sync, Speisekarte inkl. Rezept, Bestand/Bestellungen, Mitarbeiter/Schichten, Kontakte/Nachrichten senden, Bewertungen, News/Events-Zähler (nicht publizieren), offene Rechnungen, Statistiken, Handbuch.",
    "Kannst du nicht (ehrlich, App nennen): News/Events/Galerie publizieren, Integrationen verbinden, Display, Buchhaltungsbelege anlegen/senden, Verträge/Rechte, Optionsgruppen/Gerichtsbilder, Superadmin-Daten mit Restaurant-Key.",
    "Nur dieses Haus. restaurant_id nie setzen. Wochentage: weekday_label aus Tools. Handbuch: /docs/handbook/<slug>.",
    `Locale: ${input.locale} · Zeitzone: ${input.timeZone} · Heute: ${today}`,
  ].join("\n");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  }
}

export async function streamAssistantChatTurn(input: {
  ctx: AssistantToolContext;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  restaurantName: string | null;
  timeZone: string;
  locale?: AppLocale | string | null;
  llm: AssistantLlmRuntime | null;
  keyAudience: "restaurant" | "superadmin";
  signal?: AbortSignal;
  onEvent?: (event: AssistantSseEvent) => void;
}): Promise<AssistantChatTurnResult> {
  const locale = normalizeAppLocale(input.locale ?? DEFAULT_APP_LOCALE);
  const emit = (event: AssistantSseEvent) => {
    input.onEvent?.(event);
  };
  const llm = input.llm;

  if (!llm?.apiKey) {
    try {
      emit({ type: "status", phase: "thinking" });
      const reply = await runAssistantOfflineFallback({
        ctx: input.ctx,
        userMessage: input.userMessage,
        timeZone: input.timeZone,
        restaurantName: input.restaurantName,
        locale,
        keyAudience: input.keyAudience,
      });
      emit({ type: "status", phase: "writing" });
      emit({ type: "delta", text: reply });
      return {
        ok: true,
        configured: false,
        mode: "offline",
        reply,
        pendingAction: null,
      };
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      const msg = e instanceof Error ? e.message : "Offline-Assistent fehlgeschlagen.";
      console.warn("[assistant] offline", msg);
      return {
        ok: false,
        configured: false,
        status: 500,
        error: msg,
        pendingAction: null,
      };
    }
  }

  const client = new OpenAI({
    apiKey: llm.apiKey,
    ...(llm.baseURL ? { baseURL: llm.baseURL } : {}),
  });
  const providerLabel = llm.provider === "grok" ? "Grok" : "OpenAI";
  const history = clipAssistantHistory(input.history);
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt({
        restaurantName: input.restaurantName,
        timeZone: input.timeZone,
        locale,
      }),
    },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: input.userMessage },
  ];

  const toolPayloads: string[] = [];
  emit({ type: "status", phase: "thinking" });

  for (let step = 0; step < ASSISTANT_MAX_TOOL_ROUNDS; step++) {
    throwIfAborted(input.signal);

    let content = "";
    const toolAcc: AssistantStreamToolAcc[] = [];
    let emittedText = false;
    let sawToolDelta = false;

    try {
      const stream = await client.chat.completions.create({
        model: llm.model,
        messages,
        tools: ASSISTANT_TOOL_DEFINITIONS,
        tool_choice: "auto",
        temperature: 0.5,
        stream: true,
      });

      for await (const chunk of stream) {
        throwIfAborted(input.signal);
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.tool_calls?.length) {
          if (emittedText && !sawToolDelta) {
            emit({ type: "reset" });
            emittedText = false;
          }
          sawToolDelta = true;
          accumulateStreamToolCallDelta(toolAcc, delta.tool_calls);
          continue;
        }

        const piece = delta.content ?? "";
        if (!piece) continue;
        content += piece;
        if (sawToolDelta) continue;
        if (!emittedText) {
          emit({ type: "status", phase: "writing" });
          emittedText = true;
        }
        emit({ type: "delta", text: piece });
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      const msg = e instanceof Error ? e.message : `${providerLabel}-Fehler`;
      console.warn("[assistant] llm stream", llm.provider, msg);
      return {
        ok: false,
        configured: true,
        status: 502,
        error: msg,
        pendingAction: null,
      };
    }

    const toolCalls = toolAcc.filter((c) => c.id && c.function.name);
    if (toolCalls.length === 0) {
      const reply = content.trim();
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
      // If settle replaced streamed text (e.g. draft summary), sync UI.
      if (settled.reply !== reply) {
        if (emittedText) emit({ type: "reset" });
        emit({ type: "status", phase: "writing" });
        emit({ type: "delta", text: settled.reply });
      }
      if (settled.pendingAction) {
        emit({ type: "pending", pendingAction: settled.pendingAction });
      }
      return { ok: true, configured: true, mode: "llm", ...settled };
    }

    emit({ type: "status", phase: "tools" });
    messages.push({
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: {
          name: c.function.name,
          arguments: c.function.arguments,
        },
      })),
    });

    const results = await Promise.all(
      toolCalls.map((call) =>
        runAssistantToolByName(
          input.ctx,
          call.function.name,
          call.function.arguments,
          locale,
        ),
      ),
    );
    for (let i = 0; i < toolCalls.length; i++) {
      throwIfAborted(input.signal);
      const result = results[i]!;
      toolPayloads.push(result);
      messages.push({
        role: "tool",
        tool_call_id: toolCalls[i]!.id,
        content: result,
      });
    }

    if (
      toolPayloads.some((raw) => askFromToolJson(raw) || pendingActionFromToolJson(raw))
    ) {
      const settled = settleAssistantToolPayloads("", toolPayloads);
      if (settled.reply) {
        emit({ type: "status", phase: "writing" });
        emit({ type: "delta", text: settled.reply });
        if (settled.pendingAction) {
          emit({ type: "pending", pendingAction: settled.pendingAction });
        }
        return { ok: true, configured: true, mode: "llm", ...settled };
      }
    }

    emit({ type: "status", phase: "thinking" });
  }

  return {
    ok: false,
    configured: true,
    status: 502,
    error: "Zu viele Tool-Schritte — bitte die Frage kürzer formulieren.",
    pendingAction: null,
  };
}
