import type { SocialSlotKind } from "@/lib/social/social-brand-kit";
import {
  parseSocialMediaFormatId,
  type SocialMediaFormatId,
} from "@/lib/social/social-media-formats";

/** Einfache Quellen-Buckets fürs Sheet — alles optional. */
export const SOCIAL_AUTOPILOT_SOURCE_BUCKETS = [
  "menu",
  "gallery",
  "ai",
] as const;
export type SocialAutopilotSourceBucket =
  (typeof SOCIAL_AUTOPILOT_SOURCE_BUCKETS)[number];

/**
 * Client-sichere Idee für die Autopilot-Auswahl.
 * Noch kein gespeicherter Draft — erst nach User-Auswahl + Generate.
 * Quellen: Speisekarte / Galerie / KI-Stil — alle optional.
 */
export type SocialAutopilotIdea = {
  /** Stabil: menu:… / gallery:… / event:… / holiday:… / brand:… / ai:… */
  id: string;
  slotKind: SocialSlotKind;
  /** Speisekarte | Galerie | KI-Stil */
  sourceBucket: SocialAutopilotSourceBucket;
  /** Anzeige-Titel — nach Enrich oft = theme */
  title: string;
  /** Kurzlabel: Speisekarte, Galerie, KI-Stil … */
  reasonLabel: string;
  /** Konkreter Bezug: Gerichtsname, Eventtitel, Feiertagsdatum … */
  reasonDetail: string;
  imageUrl: string;
  imageLabel: string;
  /** KI / Heuristik: kreatives Thema */
  theme?: string;
  /** KI / Heuristik: Caption-Richtung / Angle */
  captionDirection?: string;
  /** KI / Heuristik: empfohlenes Medienformat */
  suggestedFormat?: SocialMediaFormatId;
  /** true wenn Restaurant-KI den Pitch geschrieben hat */
  aiSuggested?: boolean;
};

export function sourceBucketForSlot(
  slotKind: SocialSlotKind,
): SocialAutopilotSourceBucket {
  if (slotKind === "menu_dish") return "menu";
  if (slotKind === "ambient") return "gallery";
  return "ai";
}

/** Vom Client mit Generate mitgeschickte Pitch-Hints (überlebt Reload ohne 2. Ideas-LLM). */
export type SocialAutopilotIdeaHint = {
  theme?: string;
  captionDirection?: string;
  suggestedFormat?: SocialMediaFormatId;
};

export function parseSocialAutopilotIdeaId(
  raw: string,
): { kind: SocialSlotKind; ref: string } | null {
  const id = raw.trim();
  const idx = id.indexOf(":");
  if (idx <= 0) return null;
  const prefix = id.slice(0, idx);
  const ref = id.slice(idx + 1).trim();
  if (!ref) return null;
  switch (prefix) {
    case "menu":
      return { kind: "menu_dish", ref };
    case "gallery":
      return { kind: "ambient", ref };
    case "event":
      return { kind: "event", ref };
    case "holiday":
      return { kind: "holiday", ref };
    case "brand":
      return { kind: "brand", ref };
    case "ai":
      return { kind: "brand", ref };
    default:
      return null;
  }
}

export function socialAutopilotIdeaId(
  kind: "menu" | "gallery" | "event" | "holiday" | "brand" | "ai",
  ref: string,
): string {
  return `${kind}:${ref}`;
}

export function parseSocialAutopilotIdeaHints(
  raw: unknown,
): Record<string, SocialAutopilotIdeaHint> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SocialAutopilotIdeaHint> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const key = id.trim();
    if (!key || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const row = value as Record<string, unknown>;
    const theme =
      typeof row.theme === "string" ? row.theme.trim().slice(0, 80) : "";
    const captionDirection =
      typeof row.captionDirection === "string"
        ? row.captionDirection.trim().slice(0, 220)
        : "";
    const suggestedFormat = parseSocialMediaFormatId(row.suggestedFormat);
    if (!theme && !captionDirection && !suggestedFormat) continue;
    out[key] = {
      ...(theme ? { theme } : {}),
      ...(captionDirection ? { captionDirection } : {}),
      ...(suggestedFormat ? { suggestedFormat } : {}),
    };
  }
  return out;
}
