export type PlatformOpenaiConfig = {
  api_key?: string;
  /** OpenAI-Modell, Default gpt-4o-mini */
  model?: string;
};

export type PlatformOpenaiConfigUi = {
  api_key_configured?: boolean;
  model?: string;
};

export const DEFAULT_OPENAI_ASSISTANT_MODEL = "gpt-4o-mini";

export function openaiConfigFromJson(raw: unknown): PlatformOpenaiConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const str = (k: string) =>
    typeof o[k] === "string" ? (o[k] as string).trim() || undefined : undefined;
  return {
    api_key: str("api_key"),
    model: str("model"),
  };
}

export function openaiConfigToUi(
  config: PlatformOpenaiConfig,
): PlatformOpenaiConfigUi {
  return {
    api_key_configured: Boolean(config.api_key?.length),
    model: config.model?.trim() || DEFAULT_OPENAI_ASSISTANT_MODEL,
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
