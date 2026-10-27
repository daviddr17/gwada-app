import "server-only";

import OpenAI from "openai";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import {
  clipAutopilotText,
  SOCIAL_AUTOPILOT_IDEAS_MAX_COMPLETION_TOKENS,
  SOCIAL_AUTOPILOT_IDEAS_MAX_PROMPT_CHARS,
} from "@/lib/social/social-autopilot-bounds";
import {
  parseAutopilotIdeaPitchResponse,
  type SocialAutopilotIdeaPitch,
  type SocialAutopilotIdeaPitchInput,
} from "@/lib/social/social-autopilot-ideas-pitch";
import type { SocialBrandKit } from "@/lib/social/social-brand-kit";
import { SOCIAL_MEDIA_FORMAT_IDS } from "@/lib/social/social-media-formats";

export type { SocialAutopilotIdeaPitch, SocialAutopilotIdeaPitchInput };
export {
  applyIdeaPitchesToCatalog,
  heuristicIdeaPitch,
  parseAutopilotIdeaPitchResponse,
} from "@/lib/social/social-autopilot-ideas-pitch";

export type SocialAutopilotIdeasLlmOutcome = {
  ok: boolean;
  llmCalls: number;
  pitches: SocialAutopilotIdeaPitch[];
  error?: string;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

function toneLabel(tone: SocialBrandKit["tone"]): string {
  switch (tone) {
    case "casual":
      return "locker, duzend wo passend";
    case "fine":
      return "fein, ruhig, eher Siezen";
    case "modern":
      return "modern, klar, knapp";
    default:
      return "warm und einladend";
  }
}

function buildIdeasSystemPrompt(restaurantName: string): string {
  return [
    `Du planst Social-Media-Ideen für das Restaurant „${restaurantName}" (Deutschland).`,
    "Jeder Input ist optional nutzbar (Speisekarte, Galerie oder Marke/Event) — erfinde keine Gerichte, Preise oder Aktionen.",
    "Für jeden Input: ein kurzes Thema, eine Caption-Richtung und ein Format.",
    `Erlaubte Formate: ${SOCIAL_MEDIA_FORMAT_IDS.join(", ")}.`,
    "Stimme und Ton aus dem Brand-Objekt strikt einhalten (voiceNotes, doNot, goldCaptions als Stil-Vorbild).",
    "Themen und Richtungen müssen sich im Batch unterscheiden.",
    'Antwort ausschließlich als JSON-Array: [{"id":"menu:…","theme":"…","captionDirection":"…","suggestedFormat":"portrait_4x5"}, …]',
    "Kein Markdown, keine Erklärung außerhalb des JSON. Behalte die id-Werte exakt bei.",
  ].join("\n");
}

function buildIdeasUserPrompt(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  ideas: SocialAutopilotIdeaPitchInput[];
}): string {
  const { kit, restaurantName, ideas } = params;
  const brand = {
    restaurantName,
    tone: toneLabel(kit.tone),
    voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 280),
    doNot: clipAutopilotText(kit.doNot || "—", 180),
    cta: clipAutopilotText(kit.cta || "", 80),
    hashtags: kit.hashtags.slice(0, 5),
    goldCaptions: kit.goldCaptions
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((c) => clipAutopilotText(c, 160)),
  };
  const payload = {
    brand,
    inputs: ideas.map((idea) => ({
      id: idea.id,
      slotKind: idea.slotKind,
      title: idea.title,
      reason: idea.reasonDetail,
      imageLabel: idea.imageLabel,
      ...(idea.dishDescription
        ? { dishDescription: clipAutopilotText(idea.dishDescription, 120) }
        : {}),
      ...(idea.eventStartAt ? { eventStartAt: idea.eventStartAt } : {}),
      ...(idea.holidayDate ? { holidayDate: idea.holidayDate } : {}),
      ...(idea.holidayName ? { holidayName: idea.holidayName } : {}),
    })),
  };
  let json = JSON.stringify(payload, null, 0);
  if (json.length > SOCIAL_AUTOPILOT_IDEAS_MAX_PROMPT_CHARS) {
    const slim = {
      brand: {
        ...brand,
        goldCaptions: brand.goldCaptions.slice(0, 1),
        voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 120),
      },
      inputs: ideas.map((idea) => ({
        id: idea.id,
        slotKind: idea.slotKind,
        title: idea.title,
        reason: idea.reasonDetail,
      })),
    };
    json = JSON.stringify(slim, null, 0);
    if (json.length > SOCIAL_AUTOPILOT_IDEAS_MAX_PROMPT_CHARS) {
      json = json.slice(0, SOCIAL_AUTOPILOT_IDEAS_MAX_PROMPT_CHARS);
    }
  }
  return `Formuliere für jeden Input Thema, Caption-Richtung und Format.\n${json}`;
}

/**
 * One-shot Ideas-Pitch mit Restaurant-KI. Max 1 Call.
 * Bei Fehler: leere pitches — Caller wendet Heuristik an.
 */
export async function pitchAutopilotIdeasWithLlm(params: {
  llm: AssistantLlmRuntime;
  kit: SocialBrandKit;
  restaurantName: string;
  ideas: SocialAutopilotIdeaPitchInput[];
}): Promise<SocialAutopilotIdeasLlmOutcome> {
  const ideas = params.ideas;
  if (ideas.length === 0) {
    return { ok: true, llmCalls: 0, pitches: [] };
  }

  const client = new OpenAI({
    apiKey: params.llm.apiKey,
    ...(params.llm.baseURL ? { baseURL: params.llm.baseURL } : {}),
  });

  try {
    const completion = await client.chat.completions.create({
      model: params.llm.model,
      messages: [
        {
          role: "system",
          content: buildIdeasSystemPrompt(params.restaurantName),
        },
        {
          role: "user",
          content: buildIdeasUserPrompt({
            kit: params.kit,
            restaurantName: params.restaurantName,
            ideas,
          }),
        },
      ],
      temperature: 0.7,
      max_tokens: SOCIAL_AUTOPILOT_IDEAS_MAX_COMPLETION_TOKENS,
    });

    const usageRaw = completion.usage;
    const usage = usageRaw
      ? {
          promptTokens: usageRaw.prompt_tokens ?? null,
          completionTokens: usageRaw.completion_tokens ?? null,
          totalTokens: usageRaw.total_tokens ?? null,
        }
      : undefined;

    const content = completion.choices[0]?.message?.content ?? "";
    const pitches = parseAutopilotIdeaPitchResponse(
      content,
      ideas.map((i) => i.id),
    );
    if (pitches.length === 0) {
      return {
        ok: false,
        llmCalls: 1,
        pitches: [],
        error: "empty_or_unparsed",
        usage,
      };
    }
    return { ok: true, llmCalls: 1, pitches, usage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    console.warn("[social-autopilot] ideas-llm", params.llm.provider, msg);
    return { ok: false, llmCalls: 1, pitches: [], error: msg };
  }
}
