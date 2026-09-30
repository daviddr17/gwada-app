import {
  normalizeAssistantProvider,
  type AssistantLlmProvider,
} from "./platform-openai-config";

export type RestaurantAssistantPublic = {
  provider: AssistantLlmProvider;
  apiKeyConfigured: boolean;
};

/** Client payload. The key itself is never copied onto this object. */
export function restaurantAssistantToPublic(row: {
  provider?: unknown;
  api_key?: string | null;
} | null): RestaurantAssistantPublic {
  const configured = Boolean(row?.api_key?.trim());
  return {
    provider: normalizeAssistantProvider(row?.provider),
    apiKeyConfigured: configured,
  };
}

export function mergeRestaurantAssistantApiKey(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string | null {
  const next = incoming?.trim() ?? "";
  if (next) return next;
  const prev = existing?.trim() ?? "";
  return prev || null;
}
