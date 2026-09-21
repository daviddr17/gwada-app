import "server-only";

import {
  DEFAULT_OPENAI_ASSISTANT_MODEL,
  openaiConfigFromJson,
} from "@/lib/integrations/platform-openai-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** OpenAI-Key — nur Service-Role, nie an Clients. */
export async function fetchPlatformOpenaiConfigAdmin(): Promise<{
  enabled: boolean;
  apiKey: string | null;
  model: string;
}> {
  const sb = createSupabaseAdminClient();
  if (!sb) return { enabled: false, apiKey: null, model: DEFAULT_OPENAI_ASSISTANT_MODEL };

  const { data, error } = await sb
    .from("platform_integrations")
    .select("enabled, config")
    .eq("key", "openai")
    .maybeSingle();

  if (error || !data) {
    console.warn("fetchPlatformOpenaiConfigAdmin", error?.message);
    return { enabled: false, apiKey: null, model: DEFAULT_OPENAI_ASSISTANT_MODEL };
  }

  const cfg = openaiConfigFromJson(data.config);
  const apiKey = cfg.api_key?.trim() ?? "";

  return {
    enabled: Boolean(data.enabled),
    apiKey: apiKey || null,
    model: cfg.model?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
  };
}

export async function isPlatformOpenaiAvailableAdmin(): Promise<boolean> {
  const cfg = await fetchPlatformOpenaiConfigAdmin();
  return cfg.enabled && Boolean(cfg.apiKey);
}
