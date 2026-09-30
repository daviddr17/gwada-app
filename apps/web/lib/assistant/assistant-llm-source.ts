import type { AssistantLlmProvider } from "../integrations/platform-openai-config";

export type AssistantZone = "restaurant" | "superadmin";

export type AssistantLlmRuntime = {
  apiKey: string;
  model: string;
  provider: AssistantLlmProvider;
  baseURL?: string;
};

/**
 * Superadmin zone uses only the platform key.
 * A restaurant uses only its own key.
 * Neither side falls back to the other.
 */
export function pickAssistantLlm(input: {
  zone: AssistantZone;
  callerIsSuperadmin: boolean;
  platform: AssistantLlmRuntime | null;
  restaurant: AssistantLlmRuntime | null;
}): AssistantLlmRuntime | null {
  if (input.zone === "superadmin" && input.callerIsSuperadmin) {
    return input.platform?.apiKey ? input.platform : null;
  }
  return input.restaurant?.apiKey ? input.restaurant : null;
}
