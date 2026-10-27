import type { SocialSlotKind } from "@/lib/social/social-brand-kit";

/**
 * Client-sichere Idee für die Autopilot-Auswahl.
 * Noch kein gespeicherter Draft — erst nach User-Auswahl + Generate.
 */
export type SocialAutopilotIdea = {
  /** Stabil: menu:… / gallery:… / event:… / holiday:… / brand:… */
  id: string;
  slotKind: SocialSlotKind;
  title: string;
  /** Kurzlabel: Speisekarte, Galerie, … */
  reasonLabel: string;
  /** Konkreter Bezug: Gerichtsname, Eventtitel, Feiertagsdatum … */
  reasonDetail: string;
  imageUrl: string;
  imageLabel: string;
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
    default:
      return null;
  }
}

export function socialAutopilotIdeaId(
  kind: "menu" | "gallery" | "event" | "holiday" | "brand",
  ref: string,
): string {
  return `${kind}:${ref}`;
}
