import "server-only";

import {
  defaultModelForProvider,
  normalizeAssistantProvider,
  XAI_OPENAI_COMPAT_BASE_URL,
} from "@/lib/integrations/platform-openai-config";
import { mergeRestaurantAssistantApiKey } from "@/lib/integrations/restaurant-assistant-config";
import type { AssistantLlmRuntime } from "@/lib/assistant/assistant-llm-source";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type KeyRow = {
  restaurant_id: string;
  provider: string;
  api_key: string | null;
};

function missingRelation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}

export async function fetchRestaurantAssistantKeyAdmin(
  restaurantId: string,
): Promise<KeyRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("restaurant_assistant_keys")
    .select("restaurant_id, provider, api_key")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) {
    if (!missingRelation(error)) {
      console.warn("fetchRestaurantAssistantKeyAdmin", error.message);
    }
    return null;
  }
  return (data as KeyRow | null) ?? null;
}

export async function fetchRestaurantAssistantRuntime(
  restaurantId: string,
): Promise<AssistantLlmRuntime | null> {
  const row = await fetchRestaurantAssistantKeyAdmin(restaurantId);
  const apiKey = row?.api_key?.trim() ?? "";
  if (!apiKey) return null;
  const provider = normalizeAssistantProvider(row?.provider);
  return {
    apiKey,
    provider,
    model: defaultModelForProvider(provider),
    ...(provider === "grok" ? { baseURL: XAI_OPENAI_COMPAT_BASE_URL } : {}),
  };
}

export async function saveRestaurantAssistantKeyAdmin(input: {
  restaurantId: string;
  provider: unknown;
  apiKey: string | null | undefined;
}): Promise<{ error: string | null; configured: boolean; provider: "openai" | "grok" }> {
  const admin = createSupabaseAdminClient();
  const provider = normalizeAssistantProvider(input.provider);
  if (!admin) {
    return { error: "server_misconfigured", configured: false, provider };
  }
  const existing = await fetchRestaurantAssistantKeyAdmin(input.restaurantId);
  const apiKey = mergeRestaurantAssistantApiKey(existing?.api_key, input.apiKey);
  if (!apiKey) {
    return { error: "API-Key erforderlich.", configured: false, provider };
  }
  const { error } = await admin.from("restaurant_assistant_keys").upsert(
    {
      restaurant_id: input.restaurantId,
      provider,
      api_key: apiKey,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) {
    console.warn("saveRestaurantAssistantKeyAdmin", error.message);
    return { error: "Schlüssel konnte nicht gespeichert werden.", configured: false, provider };
  }
  return { error: null, configured: true, provider };
}

export async function deleteRestaurantAssistantKeyAdmin(
  restaurantId: string,
): Promise<{ error: string | null }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { error: "server_misconfigured" };
  const { error } = await admin
    .from("restaurant_assistant_keys")
    .delete()
    .eq("restaurant_id", restaurantId);
  if (error) {
    if (missingRelation(error)) return { error: null };
    console.warn("deleteRestaurantAssistantKeyAdmin", error.message);
    return { error: "Schlüssel konnte nicht entfernt werden." };
  }
  return { error: null };
}
