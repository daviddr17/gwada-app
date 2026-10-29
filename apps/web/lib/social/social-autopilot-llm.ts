import "server-only";

import OpenAI from "openai";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import type { SocialBrandKit } from "@/lib/social/social-brand-kit";
import {
  parseAutopilotCaptionResponse,
  SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS,
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  type SocialAutopilotCaptionResult,
} from "@/lib/social/social-autopilot-bounds";
import {
  autopilotCaptionSupportsVision,
  buildAutopilotCaptionSystemPrompt,
  buildAutopilotCaptionUserPrompt,
  pickAutopilotVisionImageUrls,
  type SocialAutopilotCaptionJob,
} from "@/lib/social/social-autopilot-caption-prompt";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";

export type { SocialAutopilotCaptionJob } from "@/lib/social/social-autopilot-caption-prompt";

export type SocialAutopilotLlmOutcome = {
  ok: boolean;
  /** Always 0 or 1 with current caps. */
  llmCalls: number;
  results: SocialAutopilotCaptionResult[];
  error?: string;
  usage?: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail: "low" } };

/**
 * One-shot batch caption rewrite with the restaurant OpenAI/Grok runtime.
 * No retries. Caps: max items (caller), max completion tokens, max 1 call.
 * KI-Post: optional Vision (1 Bild), damit Caption zum Foto passt.
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

  const visionOk = autopilotCaptionSupportsVision(params.llm);
  const visionUrls = visionOk ? pickAutopilotVisionImageUrls(jobs, 1) : [];
  const withVision = visionUrls.length > 0;

  const userText = buildAutopilotCaptionUserPrompt({
    kit: params.kit,
    restaurantName: params.restaurantName,
    jobs,
    withVisionImages: withVision,
  });

  const userContent: string | ChatContentPart[] = withVision
    ? [
        { type: "text", text: userText },
        ...visionUrls.map(
          (url): ChatContentPart => ({
            type: "image_url",
            image_url: { url, detail: "low" },
          }),
        ),
      ]
    : userText;

  try {
    const completion = await client.chat.completions.create({
      model: params.llm.model,
      messages: [
        {
          role: "system",
          content: buildAutopilotCaptionSystemPrompt(params.restaurantName),
        },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.45,
      max_tokens: SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS,
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
        usage,
      };
    }
    return { ok: true, llmCalls: 1, results, usage };
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
