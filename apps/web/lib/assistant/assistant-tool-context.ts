import type { AssistantZone } from "@/lib/assistant/assistant-llm-source";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssistantToolContext = {
  /** Session restaurant. Tools must not replace this with an id from the model. */
  restaurantId: string;
  userId: string;
  sb: SupabaseClient;
  zone: AssistantZone;
  callerIsSuperadmin: boolean;
};
