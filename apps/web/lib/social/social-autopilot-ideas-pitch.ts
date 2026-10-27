import {
  clipAutopilotText,
  SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
  SOCIAL_AUTOPILOT_IDEA_THEME_CHARS,
} from "@/lib/social/social-autopilot-bounds";
import type { SocialBrandKit, SocialSlotKind } from "@/lib/social/social-brand-kit";
import {
  parseSocialMediaFormatId,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";

/** Minimale Felder für Pitch — client-sicher, kein server-only. */
export type SocialAutopilotIdeaPitchInput = {
  id: string;
  slotKind: SocialSlotKind;
  title: string;
  reasonDetail: string;
  imageLabel: string;
  dishDescription?: string;
  eventStartAt?: string;
  holidayDate?: string;
  holidayName?: string;
};

export type SocialAutopilotIdeaPitch = {
  id: string;
  theme: string;
  captionDirection: string;
  suggestedFormat: SocialMediaFormatId;
};

function toneLabel(tone: SocialBrandKit["tone"]): string {
  switch (tone) {
    case "casual":
      return "locker, duzend wo passend";
    case "fine":
      return "fein, ruhig, eher Siezen";
    case "modern":
      return "modern, klar, knapp";
    default:
      return "warm und einladend";
  }
}

export function defaultFormatForSlot(slotKind: SocialSlotKind): SocialMediaFormatId {
  switch (slotKind) {
    case "event":
      return "portrait_4x5";
    case "holiday":
      return "square_1x1";
    case "brand":
      return "square_1x1";
    case "ambient":
      return "portrait_4x5";
    default:
      return "portrait_4x5";
  }
}

/** Deterministischer Fallback — kein LLM. */
export function heuristicIdeaPitch(
  idea: SocialAutopilotIdeaPitchInput,
  kit: SocialBrandKit,
): SocialAutopilotIdeaPitch {
  const name = idea.title.trim() || idea.reasonDetail.trim() || "Beitrag";
  let theme: string;
  let captionDirection: string;
  switch (idea.slotKind) {
    case "menu_dish":
      theme = clipAutopilotText(`Heute: ${name}`, SOCIAL_AUTOPILOT_IDEA_THEME_CHARS);
      captionDirection = clipAutopilotText(
        idea.dishDescription
          ? `Gericht vorstellen — ${idea.dishDescription}. Ton: ${toneLabel(kit.tone)}. CTA und Hashtags aus Brand Kit.`
          : `Gericht vorstellen, Appetit wecken. Ton: ${toneLabel(kit.tone)}.`,
        SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
      );
      break;
    case "event":
      theme = clipAutopilotText(`Termin: ${name}`, SOCIAL_AUTOPILOT_IDEA_THEME_CHARS);
      captionDirection = clipAutopilotText(
        `Event ankündigen, Datum/Zeit nennen, einladen. Ton: ${toneLabel(kit.tone)}.`,
        SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
      );
      break;
    case "ambient":
      theme = clipAutopilotText(
        name === "Ambiente" || name === "Galerie" ? "Stimmung im Haus" : name,
        SOCIAL_AUTOPILOT_IDEA_THEME_CHARS,
      );
      captionDirection = clipAutopilotText(
        `Atmosphäre beschreiben, ohne Spekulation über Gerichte. Ton: ${toneLabel(kit.tone)}.`,
        SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
      );
      break;
    case "holiday":
      theme = clipAutopilotText(
        `${idea.holidayName ?? name} bei uns`,
        SOCIAL_AUTOPILOT_IDEA_THEME_CHARS,
      );
      captionDirection = clipAutopilotText(
        `Feiertagsgruß, einladend, ohne erfundene Aktionen. Ton: ${toneLabel(kit.tone)}.`,
        SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
      );
      break;
    default:
      theme = clipAutopilotText(
        kit.cta?.trim() ? `Marke · ${kit.cta.trim()}` : "Eure Marke",
        SOCIAL_AUTOPILOT_IDEA_THEME_CHARS,
      );
      captionDirection = clipAutopilotText(
        `Wiedererkennung und Einladung. Stimme aus Brand Kit. Ton: ${toneLabel(kit.tone)}.`,
        SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS,
      );
  }
  return {
    id: idea.id,
    theme,
    captionDirection,
    suggestedFormat: defaultFormatForSlot(idea.slotKind),
  };
}

/** Pure parse — unit-tested without network. */
export function parseAutopilotIdeaPitchResponse(
  raw: string,
  expectedIds: string[],
): SocialAutopilotIdeaPitch[] {
  const expected = new Set(expectedIds);
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

  const out: SocialAutopilotIdeaPitch[] = [];
  const seen = new Set<string>();
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id || !expected.has(id) || seen.has(id)) continue;
    const theme =
      typeof o.theme === "string"
        ? clipAutopilotText(o.theme, SOCIAL_AUTOPILOT_IDEA_THEME_CHARS)
        : "";
    const captionDirection =
      typeof o.captionDirection === "string"
        ? clipAutopilotText(o.captionDirection, SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS)
        : typeof o.direction === "string"
          ? clipAutopilotText(o.direction, SOCIAL_AUTOPILOT_IDEA_DIRECTION_CHARS)
          : "";
    if (theme.length < 3 || captionDirection.length < 8) continue;
    const suggestedFormat =
      parseSocialMediaFormatId(o.suggestedFormat) ??
      parseSocialMediaFormatId(o.format) ??
      "portrait_4x5";
    seen.add(id);
    out.push({ id, theme, captionDirection, suggestedFormat });
  }
  return out;
}

export function applyIdeaPitchesToCatalog<T extends SocialAutopilotIdeaPitchInput>(
  params: {
    catalog: T[];
    pitches: SocialAutopilotIdeaPitch[];
    kit: SocialBrandKit;
    fromLlm: boolean;
  },
): Array<
  T & {
    theme: string;
    captionDirection: string;
    suggestedFormat: SocialMediaFormatId;
    aiSuggested: boolean;
    title: string;
  }
> {
  const byId = new Map(params.pitches.map((p) => [p.id, p]));
  return params.catalog.map((idea) => {
    const hit = byId.get(idea.id);
    const pitch = hit ?? heuristicIdeaPitch(idea, params.kit);
    return {
      ...idea,
      theme: pitch.theme,
      captionDirection: pitch.captionDirection,
      suggestedFormat: pitch.suggestedFormat,
      title: pitch.theme,
      aiSuggested: params.fromLlm && Boolean(hit),
    };
  });
}
