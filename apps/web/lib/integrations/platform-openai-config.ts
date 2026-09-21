export type AssistantLlmProvider = "openai" | "grok";

export type PlatformOpenaiConfig = {
  api_key?: string;
  /** openai | grok — Grok nutzt xAI (OpenAI-kompatibel) */
  provider?: AssistantLlmProvider;
  /** Modell-ID, Default je Provider */
  model?: string;
};

export type PlatformOpenaiConfigUi = {
  api_key_configured?: boolean;
  provider?: AssistantLlmProvider;
  model?: string;
};

export const DEFAULT_OPENAI_ASSISTANT_MODEL = "gpt-4o-mini";
export const DEFAULT_GROK_ASSISTANT_MODEL = "grok-3-mini";
export const XAI_OPENAI_COMPAT_BASE_URL = "https://api.x.ai/v1";

export function normalizeAssistantProvider(
  raw: unknown,
): AssistantLlmProvider {
  return raw === "grok" ? "grok" : "openai";
}

export function defaultModelForProvider(
  provider: AssistantLlmProvider,
): string {
  return provider === "grok"
    ? DEFAULT_GROK_ASSISTANT_MODEL
    : DEFAULT_OPENAI_ASSISTANT_MODEL;
}

export function openaiConfigFromJson(raw: unknown): PlatformOpenaiConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    api_key: str("api_key"),
    provider: normalizeAssistantProvider(o.provider ?? str("provider")),
    model: str("model"),
  };
}

export function openaiConfigToUi(
  config: PlatformOpenaiConfig,
): PlatformOpenaiConfigUi {
  const provider = normalizeAssistantProvider(config.provider);
  return {
    api_key_configured: Boolean(config.api_key?.length),
    provider,
    model: config.model?.trim() || defaultModelForProvider(provider),
  };
}

export function mergeOpenaiApiKey(
  incoming: string | undefined,
  existing: PlatformOpenaiConfig,
): string | undefined {
  const next = incoming?.trim();
  if (next) return next;
  return existing.api_key;
}
