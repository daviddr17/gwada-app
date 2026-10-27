import "server-only";

import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readCachedNewsItems } from "@/lib/news/news-cache-db";
import type { SocialTone } from "@/lib/social/social-brand-kit";
import { SOCIAL_TONES } from "@/lib/social/social-brand-kit";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import { insertRestaurantAiUsageEvent } from "@/lib/supabase/restaurant-ai-usage-db";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

export type SocialBrandVoiceDraft = {
  voiceNotes: string;
  goldCaptions: string[];
  tone: SocialTone | null;
  sampleCount: number;
  sourcePlatforms: string[];
  /** true wenn LLM genutzt wurde (sonst Heuristik). */
  fromLlm: boolean;
};

function heuristicDraft(captions: string[]): SocialBrandVoiceDraft {
  const gold = captions
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 24 && c.length <= 280)
    .slice(0, 5);
  const joined = captions.slice(0, 8).join(" ").toLowerCase();
  let tone: SocialTone | null = "warm";
  if (joined.includes("du ") || joined.includes("ihr ") || joined.includes("euch")) {
    tone = "casual";
  } else if (
    joined.includes("sie ") ||
    joined.includes("ihnen") ||
    joined.includes("genießen sie")
  ) {
    tone = "fine";
  }
  const voiceNotes = [
    "Aus euren bestehenden Social-Posts abgeleitet (Vorschlag — bitte prüfen).",
    tone === "casual"
      ? "Eher Duzen / locker."
      : tone === "fine"
        ? "Eher höflich / ruhig."
        : "Warm und einladend.",
    "Keine erfundenen Angebote oder Preise übernehmen.",
  ].join(" ");
  return {
    voiceNotes,
    goldCaptions: gold,
    tone,
    sampleCount: captions.length,
    sourcePlatforms: [],
    fromLlm: false,
  };
}

/**
 * Opt-in: Stimme aus verbundenen IG/FB-Captions vorschlagen — schreibt nicht ins Brand Kit.
 */
export async function draftSocialBrandVoiceFromFeed(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<
  | { ok: true; draft: SocialBrandVoiceDraft }
  | { ok: false; error: string }
> {
  const items = await readCachedNewsItems(sb, restaurantId, [
    "instagram",
    "facebook",
  ]);
  const captions: string[] = [];
  const platforms = new Set<string>();
  for (const item of items) {
    const body = (item.body ?? "").trim();
    if (body.length < 20) continue;
    captions.push(body.slice(0, 400));
    if (item.platform) platforms.add(item.platform);
    if (captions.length >= 24) break;
  }

  if (captions.length < 3) {
    return { ok: false, error: "not_enough_posts" };
  }

  const kit = await fetchSocialBrandKitFromDb(sb, restaurantId);
  const llm = await fetchRestaurantAssistantRuntime(restaurantId);
  if (!llm?.apiKey) {
    const draft = heuristicDraft(captions);
    draft.sourcePlatforms = [...platforms];
    return { ok: true, draft };
  }

  try {
    const client = new OpenAI({
      apiKey: llm.apiKey,
      ...(llm.baseURL ? { baseURL: llm.baseURL } : {}),
    });
    const completion = await client.chat.completions.create({
      model: llm.model,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: [
            "Du analysierst Social-Captions eines deutschen Restaurants.",
            "Antworte nur als JSON: {\"voiceNotes\":\"…\",\"goldCaptions\":[\"…\"],\"tone\":\"casual|warm|fine|modern\"}",
            "voiceNotes: 2–4 kurze Sätze auf Deutsch (Ton, Du/Sie, Do's).",
            "goldCaptions: 3–5 kurze Beispiel-Zeilen aus dem Stil (keine neuen Angebote erfinden).",
            `Aktueller Ton im Brand Kit: ${kit.tone}.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({ captions: captions.slice(0, 16) }),
        },
      ],
    });

    await insertRestaurantAiUsageEvent(sb, {
      restaurantId,
      source: "brand_learn",
      provider: llm.provider,
      model: llm.model,
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
      totalTokens: completion.usage?.total_tokens ?? null,
      meta: { sampleCount: captions.length },
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) {
      const draft = heuristicDraft(captions);
      draft.sourcePlatforms = [...platforms];
      return { ok: true, draft };
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      voiceNotes?: unknown;
      goldCaptions?: unknown;
      tone?: unknown;
    };
    const tone =
      typeof parsed.tone === "string" &&
      SOCIAL_TONES.includes(parsed.tone as SocialTone)
        ? (parsed.tone as SocialTone)
        : null;
    const gold = Array.isArray(parsed.goldCaptions)
      ? parsed.goldCaptions
          .filter((c): c is string => typeof c === "string")
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    const voiceNotes =
      typeof parsed.voiceNotes === "string" && parsed.voiceNotes.trim()
        ? parsed.voiceNotes.trim().slice(0, 2000)
        : heuristicDraft(captions).voiceNotes;

    return {
      ok: true,
      draft: {
        voiceNotes,
        goldCaptions: gold.length ? gold : heuristicDraft(captions).goldCaptions,
        tone,
        sampleCount: captions.length,
        sourcePlatforms: [...platforms],
        fromLlm: true,
      },
    };
  } catch (e) {
    console.warn(
      "[social-brand-learn]",
      e instanceof Error ? e.message : "error",
    );
    const draft = heuristicDraft(captions);
    draft.sourcePlatforms = [...platforms];
    return { ok: true, draft };
  }
}
