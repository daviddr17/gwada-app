/**
 * Hard cost bounds for News Autopilot LLM runs (restaurant key only).
 * Keep in sync with PR notes for David — do not raise without an explicit ask.
 */
export const SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN = 7;
/** One chat completion per generate invocation — no retry loop. */
export const SOCIAL_AUTOPILOT_MAX_LLM_CALLS = 1;
/** Completion budget for the whole batch (all captions in one response). */
export const SOCIAL_AUTOPILOT_MAX_COMPLETION_TOKENS = 1200;
/** Soft cap on user-prompt size (chars) before truncation of long fields. */
export const SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS = 5500;
/** Per-caption hard length after parse (chars). */
export const SOCIAL_AUTOPILOT_MAX_CAPTION_CHARS = 900;
export const SOCIAL_AUTOPILOT_MAX_TITLE_CHARS = 80;

export type SocialAutopilotCaptionResult = {
  index: number;
  title: string | null;
  caption: string;
};

export function clipAutopilotText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

/** Pure parse helper — unit-tested without network. */
export function parseAutopilotCaptionResponse(
  raw: string,
  expectedIndexes: number[],
): SocialAutopilotCaptionResult[] {
  const expected = new Set(expectedIndexes);
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: SocialAutopilotCaptionResult[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const index = typeof o.index === "number" ? o.index : Number(o.index);
    if (!Number.isInteger(index) || !expected.has(index)) continue;
    const caption =
      typeof o.caption === "string"
        ? clipAutopilotText(o.caption, SOCIAL_AUTOPILOT_MAX_CAPTION_CHARS)
        : "";
    if (caption.length < 8) continue;
    const titleRaw = typeof o.title === "string" ? o.title.trim() : "";
    out.push({
      index,
      title: titleRaw
        ? clipAutopilotText(titleRaw, SOCIAL_AUTOPILOT_MAX_TITLE_CHARS)
        : null,
      caption,
    });
  }
  return out;
}

export function clampAutopilotItemCount(need: number): number {
  if (!Number.isFinite(need) || need <= 0) return 0;
  return Math.min(Math.floor(need), SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN);
}
