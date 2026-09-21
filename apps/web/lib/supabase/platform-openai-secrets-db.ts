import "server-only";

import {
  defaultModelForProvider,
  normalizeAssistantProvider,
  openaiConfigFromJson,
  XAI_OPENAI_COMPAT_BASE_URL,
  type AssistantLlmProvider,
} from "@/lib/integrations/platform-openai-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Assistenten-LLM (OpenAI oder Grok/xAI) — nur Service-Role, nie an Clients. */
export async function fetchPlatformOpenaiConfigAdmin(): Promise<{
  enabled: boolean;
  apiKey: string | null;
  model: string;
  provider: AssistantLlmProvider;
  /** Für OpenAI-SDK: xAI-Base-URL bei Grok, sonst undefined (= OpenAI default). */
  baseURL: string | undefined;
}> {
  const fallbackProvider: AssistantLlmProvider = "openai";
  const fallback = {
    enabled: false,
    apiKey: null as string | null,
    model: defaultModelForProvider(fallbackProvider),
    provider: fallbackProvider,
    baseURL: undefined as string | undefined,
  };

  const sb = createSupabaseAdminClient();
  if (!sb) return fallback;

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "openai")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformOpenaiConfigAdmin", error?.message);
    return fallback;
  }

  const cfg = openaiConfigFromJson(data.config);
  const provider = normalizeAssistantProvider(cfg.provider);
  const apiKey = cfg.api_key?.trim() ?? "";

  return {
    enabled: Boolean(data.enabled),
    apiKey: apiKey || null,
    model: cfg.model?.trim() || defaultModelForProvider(provider),
    provider,
    baseURL: provider === "grok" ? XAI_OPENAI_COMPAT_BASE_URL : undefined,
  };
}

export async function isPlatformOpenaiAvailableAdmin(): Promise<boolean> {
  const cfg = await fetchPlatformOpenaiConfigAdmin();
  return cfg.enabled && Boolean(cfg.apiKey);
}
