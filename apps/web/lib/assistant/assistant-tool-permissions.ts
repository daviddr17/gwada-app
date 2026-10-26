import "server-only";

import type OpenAI from "openai";
import { ASSISTANT_TOOL_DEFINITIONS } from "@/lib/assistant/assistant-tool-definitions";
import { filterAssistantToolDefinitions } from "@/lib/assistant/assistant-tool-permission-map";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  ASSISTANT_TOOL_ANY_OF_PERMISSIONS,
  filterAssistantToolDefinitions,
} from "@/lib/assistant/assistant-tool-permission-map";

export async function loadUserRestaurantPermissionKeys(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<Set<string> | null> {
  const { data, error } = await sb.rpc("auth_user_restaurant_permission_keys", {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    console.warn("[assistant] permission keys", error.message);
    return null;
  }
  if (!Array.isArray(data)) return new Set();
  return new Set(data.map((k) => String(k)));
}

export async function assistantToolsForCaller(input: {
  sb: SupabaseClient;
  restaurantId: string;
  skipFilter?: boolean;
}): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
  if (input.skipFilter) return ASSISTANT_TOOL_DEFINITIONS;
  const keys = await loadUserRestaurantPermissionKeys(
    input.sb,
    input.restaurantId,
  );
  return filterAssistantToolDefinitions(ASSISTANT_TOOL_DEFINITIONS, keys);
}
