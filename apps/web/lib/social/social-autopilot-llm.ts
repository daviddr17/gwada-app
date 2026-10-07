import "server-only";

import OpenAI from "openai";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import type { SocialBrandKit, SocialSlotKind } from "@/lib/social/social-brand-kit";
import {
  clipAutopilotText,
  parseAutopilotCaptionResponse,
  SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS,
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS,
  type SocialAutopilotCaptionResult,
} from "@/lib/social/social-autopilot-bounds";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";

export type SocialAutopilotCaptionJob = {
  index: number;
  slotKind: SocialSlotKind;
  title: string | null;
  imageLabel: string | null;
  /** Fakten, die das Modell nutzen darf — keine Spekulation darüber hinaus. */
  facts: Record<string, string>;
  templateCaption: string;
};

export type SocialAutopilotLlmOutcome = {
  ok: boolean;
  /** Always 0 or 1 with current caps. */
  llmCalls: number;
  results: SocialAutopilotCaptionResult[];
  error?: string;
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

function buildSystemPrompt(restaurantName: string): string {
  return [
    `Du schreibst Social-Media-Beiträge (Instagram/Facebook/Google) für das Restaurant „${restaurantName}" in Deutschland.`,
    "Sprache: natürliches Deutsch, kein Marketing-Kauderwelsch, keine erfundenen Gerichte, Preise, Aktionen oder Bildinhalte.",
    "Nur Fakten aus dem JSON-Job nutzen. Galerie/Ambiente: Atmosphäre oder Bildunterschrift — nichts Spekulatives auf dem Teller.",
    "Jeder Caption-Text: 2–4 kurze Zeilen, dann optional CTA, dann Hashtags (max. 5) wenn im Brand Kit vorgegeben.",
    "Antwort ausschließlich als JSON-Array: [{\"index\":0,\"title\":\"…\",\"caption\":\"…\"}, …]",
    "Kein Markdown, keine Erklärung außerhalb des JSON.",
  ].join("\n");
}

function buildUserPrompt(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  jobs: SocialAutopilotCaptionJob[];
}): string {
  const { kit, restaurantName, jobs } = params;
  const gold = kit.goldCaptions
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((c) => clipAutopilotText(c, 220));

  const brand = {
    restaurantName,
    tone: toneLabel(kit.tone),
    voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 280),
    doNot: clipAutopilotText(kit.doNot || "—", 200),
    cta: clipAutopilotText(kit.cta || "", 80),
    hashtags: kit.hashtags.slice(0, 5),
    goldCaptions: gold,
  };

  const payload = {
    brand,
    posts: jobs.map((j) => ({
      index: j.index,
      slotKind: j.slotKind,
      title: j.title,
      imageLabel: j.imageLabel,
      facts: j.facts,
      styleHint: clipAutopilotText(j.templateCaption, 220),
    })),
  };

  let json = JSON.stringify(payload, null, 0);
  if (json.length > SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS) {
    const slim = {
      brand: {
        ...brand,
        goldCaptions: gold.slice(0, 1),
        voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 120),
      },
      posts: jobs.map((j) => ({
        index: j.index,
        slotKind: j.slotKind,
        title: j.title,
        imageLabel: j.imageLabel,
        facts: j.facts,
      })),
    };
    json = JSON.stringify(slim, null, 0);
    if (json.length > SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS) {
      json = json.slice(0, SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS);
    }
  }

  return `Schreibe für jeden Eintrag in posts einen Titel (kurz) und eine Caption. Behalte die index-Werte bei.\n${json}`;
}

/**
 * One-shot batch caption rewrite with the restaurant OpenAI/Grok runtime.
 * No retries. Caps: max items (caller), max completion tokens, max 1 call.
 */
export async function rewriteAutopilotCaptionsWithLlm(params: {
  llm: AssistantLlmRuntime;
  kit: SocialBrandKit;
  restaurantName: string;
  jobs: SocialAutopilotCaptionJob[];
}): Promise<SocialAutopilotLlmOutcome> {
  const jobs = params.jobs.slice(0, SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN);
  if (jobs.length === 0) {
    return { ok: true, llmCalls: 0, results: [] };
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
          content: buildSystemPrompt(params.restaurantName),
        },
        {
          role: "user",
          content: buildUserPrompt({
            kit: params.kit,
            restaurantName: params.restaurantName,
            jobs,
          }),
        },
      ],
      temperature: 0.65,
      max_tokens: SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS,
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const results = parseAutopilotCaptionResponse(
      content,
      jobs.map((j) => j.index),
    );
    if (results.length === 0) {
      return {
        ok: false,
        llmCalls: 1,
        results: [],
        error: "empty_or_unparsed",
      };
    }
    return { ok: true, llmCalls: 1, results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "llm_error";
    console.warn("[social-autopilot] llm", params.llm.provider, msg);
    return { ok: false, llmCalls: 1, results: [], error: msg };
  }
}

export function applyAutopilotCaptionResults(params: {
  captions: string[];
  titles: Array<string | null>;
  sources: Array<Record<string, unknown>>;
  kit: SocialBrandKit;
  llmResults: SocialAutopilotCaptionResult[];
}): {
  captions: string[];
  titles: Array<string | null>;
  sources: Array<Record<string, unknown>>;
  llmApplied: number;
} {
  const captions = [...params.captions];
  const titles = [...params.titles];
  const sources = params.sources.map((s) => ({ ...s }));
  const byIndex = new Map(params.llmResults.map((r) => [r.index, r]));
  let llmApplied = 0;

  for (let i = 0; i < captions.length; i++) {
    const hit = byIndex.get(i);
    if (!hit) {
      sources[i] = { ...sources[i], captionSource: "template_fallback" };
      continue;
    }
    captions[i] = hit.caption;
    if (hit.title) titles[i] = hit.title;
    sources[i] = {
      ...sources[i],
      captionSource: "llm",
      overlayLine: overlayLineFromCaption(hit.caption, params.kit),
    };
    llmApplied += 1;
  }

  return { captions, titles, sources, llmApplied };
}
