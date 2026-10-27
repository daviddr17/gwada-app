import type { SocialSlotKind } from "@/lib/social/social-brand-kit";
import type { SocialAutopilotIdea } from "@/lib/social/social-autopilot-ideas";

/** Filter-Chips über der Ideenliste — Reihenfolge = empfohlene Priorität. */
export const SOCIAL_AUTOPILOT_IDEA_FILTERS = [
  "all",
  "event",
  "menu_dish",
  "ambient",
  "holiday",
  "brand",
] as const;

export type SocialAutopilotIdeaFilter =
  (typeof SOCIAL_AUTOPILOT_IDEA_FILTERS)[number];

export const SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS: Record<
  SocialAutopilotIdeaFilter,
  string
> = {
  all: "Empfohlen",
  event: "Events",
  menu_dish: "Speisekarte",
  ambient: "Galerie",
  holiday: "Feiertag",
  brand: "Marke",
};

/** Gruppenreihenfolge: baldige Events → Speisekarte → Galerie → Feiertag → Marke. */
export const SOCIAL_AUTOPILOT_IDEA_GROUP_ORDER: readonly SocialSlotKind[] = [
  "event",
  "menu_dish",
  "ambient",
  "holiday",
  "brand",
] as const;

export const SOCIAL_AUTOPILOT_IDEA_GROUP_LABELS: Record<SocialSlotKind, string> =
  {
    event: "Baldige Events",
    menu_dish: "Speisekarte",
    ambient: "Galerie",
    holiday: "Nahe Feiertage",
    brand: "Social-Marke",
  };

export const SOCIAL_AUTOPILOT_IDEA_GROUP_HINTS: Record<SocialSlotKind, string> = {
  event: "Zuerst — Termine in den nächsten Tagen",
  menu_dish: "Gerichte mit Foto aus eurer Karte",
  ambient: "Ambiente aus der Galerie",
  holiday: "Nur wenn bald anstehend",
  brand: "Titelbild oder Logo",
};

export function filterSocialAutopilotIdeas(
  ideas: SocialAutopilotIdea[],
  filter: SocialAutopilotIdeaFilter,
): SocialAutopilotIdea[] {
  if (filter === "all") return ideas;
  return ideas.filter((idea) => idea.slotKind === filter);
}

export type SocialAutopilotIdeaGroup = {
  slotKind: SocialSlotKind;
  label: string;
  hint: string;
  ideas: SocialAutopilotIdea[];
};

/**
 * Gruppiert Ideen in der empfohlenen Reihenfolge.
 * Innerhalb einer Gruppe bleibt die Server-Reihenfolge (bereits rotiert/priorisiert).
 */
export function groupSocialAutopilotIdeas(
  ideas: SocialAutopilotIdea[],
): SocialAutopilotIdeaGroup[] {
  const byKind = new Map<SocialSlotKind, SocialAutopilotIdea[]>();
  for (const idea of ideas) {
    const list = byKind.get(idea.slotKind) ?? [];
    list.push(idea);
    byKind.set(idea.slotKind, list);
  }
  const groups: SocialAutopilotIdeaGroup[] = [];
  for (const slotKind of SOCIAL_AUTOPILOT_IDEA_GROUP_ORDER) {
    const list = byKind.get(slotKind);
    if (!list?.length) continue;
    groups.push({
      slotKind,
      label: SOCIAL_AUTOPILOT_IDEA_GROUP_LABELS[slotKind],
      hint: SOCIAL_AUTOPILOT_IDEA_GROUP_HINTS[slotKind],
      ideas: list,
    });
  }
  return groups;
}

/** Nur Filter-Chips anzeigen, für die es Ideen gibt (+ immer Empfohlen). */
export function availableSocialAutopilotIdeaFilters(
  ideas: SocialAutopilotIdea[],
): SocialAutopilotIdeaFilter[] {
  const present = new Set(ideas.map((i) => i.slotKind));
  return SOCIAL_AUTOPILOT_IDEA_FILTERS.filter(
    (f) => f === "all" || present.has(f),
  );
}
