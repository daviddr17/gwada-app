/** Recent turns only — keeps latency stable on long threads. */
export const ASSISTANT_HISTORY_MAX_MESSAGES = 20;

/** Cap runaway LLM↔tool loops; confirm flows usually need 1–2 rounds. */
export const ASSISTANT_MAX_TOOL_ROUNDS = 4;

export function clipAssistantHistory<T>(history: T[]): T[] {
  if (history.length <= ASSISTANT_HISTORY_MAX_MESSAGES) return history;
  return history.slice(-ASSISTANT_HISTORY_MAX_MESSAGES);
}
