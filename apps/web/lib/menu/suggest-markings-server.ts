import "server-only";

import OpenAI from "openai";
import {
  foodMarkingsForCountry,
  normalizeFoodMarkingCodes,
} from "@/lib/menu/food-marking-catalog";
import { normalizeCountryIso2 } from "@/lib/restaurant/country-profile";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertRestaurantAiUsageEvent } from "@/lib/supabase/restaurant-ai-usage-db";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

export type SuggestMarkingsKind = "ingredient" | "dish";

export type SuggestMarkingsResult =
  | {
      ok: true;
      codes: string[];
      aiConfigured: true;
      provider: string;
      model: string;
    }
  | {
      ok: false;
      codes: [];
      aiConfigured: boolean;
      error: string;
      status: number;
    };

async function loadRestaurantCountryIso2(
  restaurantId: string,
): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (!admin) return "DE";
  const { data } = await admin
    .from("restaurants")
    .select("country_iso2")
    .eq("id", restaurantId)
    .maybeSingle();
  return normalizeCountryIso2(
    typeof data?.country_iso2 === "string" ? data.country_iso2 : "DE",
  );
}

function buildPrompt(params: {
  kind: SuggestMarkingsKind;
  name: string;
  description?: string;
  countryIso2: string;
}): { system: string; user: string; allowedCodes: string[] } {
  const catalog = foodMarkingsForCountry(params.countryIso2);
  const allowedCodes = catalog.map((m) => m.code);
  const list = catalog
    .map((m) => `${m.code}=${m.label} (${m.kind})`)
    .join("; ");
  const target =
    params.kind === "ingredient"
      ? `Zutat „${params.name}“`
      : `Gericht „${params.name}“`;
  const desc = params.description?.trim()
    ? `\nBeschreibung: ${params.description.trim()}`
    : "";
  return {
    allowedCodes,
    system:
      "Du bist Lebensmittelexperte für Speisekarten-Kennzeichnung. Antworte NUR mit JSON: {\"codes\":[\"a\",\"1\"]} — nur Codes aus der erlaubten Liste. Lieber zu wenig als falsch. Keine Erklärungen.",
    user: `Land: ${params.countryIso2}\nZiel: ${target}${desc}\nErlaubte Codes: ${list}\nWelche Kennzeichnungscodes treffen zu?`,
  };
}

function parseCodesJson(content: string, allowed: string[]): string[] {
  const trimmed = content.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as {
      codes?: unknown;
    };
    return normalizeFoodMarkingCodes(parsed.codes, undefined).filter((c) =>
      allowed.includes(c),
    );
  } catch {
    return [];
  }
}

async function runLlmSuggest(params: {
  llm: AssistantLlmRuntime;
  system: string;
  user: string;
  allowedCodes: string[];
}): Promise<{ codes: string[]; usage?: {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}; error?: string }> {
  const client = new OpenAI({
    apiKey: params.llm.apiKey,
    ...(params.llm.baseURL ? { baseURL: params.llm.baseURL } : {}),
  });
  try {
    const completion = await client.chat.completions.create({
      model: params.llm.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: 0.2,
      max_tokens: 400,
    });
    const usageRaw = completion.usage;
    const content = completion.choices[0]?.message?.content ?? "";
    return {
      codes: parseCodesJson(content, params.allowedCodes),
      usage: usageRaw
        ? {
            promptTokens: usageRaw.prompt_tokens ?? null,
            completionTokens: usageRaw.completion_tokens ?? null,
            totalTokens: usageRaw.total_tokens ?? null,
          }
        : undefined,
    };
  } catch (e) {
    return {
      codes: [],
      error: e instanceof Error ? e.message : "llm_error",
    };
  }
}

export async function suggestFoodMarkings(params: {
  restaurantId: string;
  kind: SuggestMarkingsKind;
  name: string;
  description?: string;
}): Promise<SuggestMarkingsResult> {
  const name = params.name.trim();
  if (!name) {
    return {
      ok: false,
      codes: [],
      aiConfigured: false,
      error: "name_required",
      status: 400,
    };
  }

  const llm = await fetchRestaurantAssistantRuntime(params.restaurantId);
  if (!llm?.apiKey) {
    return {
      ok: false,
      codes: [],
      aiConfigured: false,
      error: "ai_not_configured",
      status: 400,
    };
  }

  const countryIso2 = await loadRestaurantCountryIso2(params.restaurantId);
  const prompt = buildPrompt({
    kind: params.kind,
    name,
    description: params.description,
    countryIso2,
  });

  const result = await runLlmSuggest({
    llm,
    system: prompt.system,
    user: prompt.user,
    allowedCodes: prompt.allowedCodes,
  });

  const admin = createSupabaseAdminClient();
  if (admin) {
    await insertRestaurantAiUsageEvent(admin, {
      restaurantId: params.restaurantId,
      source: "menu_markings",
      provider: llm.provider,
      model: llm.model,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      totalTokens: result.usage?.totalTokens,
      meta: {
        kind: params.kind,
        name,
        codeCount: result.codes.length,
        ...(result.error ? { error: result.error } : {}),
      },
    });
  }

  if (result.error) {
    return {
      ok: false,
      codes: [],
      aiConfigured: true,
      error: result.error,
      status: 502,
    };
  }

  return {
    ok: true,
    codes: sortAndFilter(result.codes, countryIso2),
    aiConfigured: true,
    provider: llm.provider,
    model: llm.model,
  };
}

function sortAndFilter(codes: string[], countryIso2: string): string[] {
  return normalizeFoodMarkingCodes(codes, countryIso2);
}
