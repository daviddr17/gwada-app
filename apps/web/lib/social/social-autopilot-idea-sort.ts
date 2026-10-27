import type {
  SocialAutopilotIdea,
  SocialAutopilotSourceBucket,
} from "@/lib/social/social-autopilot-ideas";

/**
 * Filter im Sheet — alles optional:
 * Alle · Speisekarte · Galerie · KI-Ideen
 */
export const SOCIAL_AUTOPILOT_IDEA_FILTERS = [
  "all",
  "menu",
  "gallery",
  "ai",
] as const;

export type SocialAutopilotIdeaFilter =
  (typeof SOCIAL_AUTOPILOT_IDEA_FILTERS)[number];

export const SOCIAL_AUTOPILOT_IDEA_FILTER_LABELS: Record<
  SocialAutopilotIdeaFilter,
  string
> = {
  all: "Alle",
  menu: "Speisekarte",
  gallery: "Galerie",
  ai: "KI-Ideen",
};

/** Gruppenreihenfolge im Sheet. */
export const SOCIAL_AUTOPILOT_IDEA_GROUP_ORDER: readonly SocialAutopilotSourceBucket[] =
  ["menu", "gallery", "ai"] as const;

export const SOCIAL_AUTOPILOT_IDEA_GROUP_LABELS: Record<
  SocialAutopilotSourceBucket,
  string
> = {
  menu: "Speisekarte",
  gallery: "Galerie",
  ai: "KI-Ideen",
};

export const SOCIAL_AUTOPILOT_IDEA_GROUP_HINTS: Record<
  SocialAutopilotSourceBucket,
  string
> = {
  menu: "Gerichte",
  gallery: "Fotos",
  ai: "Im euren Stil",
};

export function filterSocialAutopilotIdeas(
  ideas: SocialAutopilotIdea[],
  filter: SocialAutopilotIdeaFilter,
): SocialAutopilotIdea[] {
  if (filter === "all") return ideas;
  return ideas.filter((idea) => idea.sourceBucket === filter);
}

export type SocialAutopilotIdeaGroup = {
  sourceBucket: SocialAutopilotSourceBucket;
  /** @deprecated alias für ältere Call-Sites — gleich sourceBucket als Slot-Proxy */
  slotKind: SocialAutopilotSourceBucket;
  label: string;
  hint: string;
  ideas: SocialAutopilotIdea[];
};

/**
 * Gruppiert Ideen nach Quelle (Speisekarte / Galerie / KI-Stil).
 */
export function groupSocialAutopilotIdeas(
  ideas: SocialAutopilotIdea[],
): SocialAutopilotIdeaGroup[] {
  const byBucket = new Map<SocialAutopilotSourceBucket, SocialAutopilotIdea[]>();
  for (const idea of ideas) {
    const list = byBucket.get(idea.sourceBucket) ?? [];
    list.push(idea);
    byBucket.set(idea.sourceBucket, list);
  }
  const groups: SocialAutopilotIdeaGroup[] = [];
  for (const sourceBucket of SOCIAL_AUTOPILOT_IDEA_GROUP_ORDER) {
    const list = byBucket.get(sourceBucket);
    if (!list?.length) continue;
    groups.push({
      sourceBucket,
      slotKind: sourceBucket,
      label: SOCIAL_AUTOPILOT_IDEA_GROUP_LABELS[sourceBucket],
      hint: SOCIAL_AUTOPILOT_IDEA_GROUP_HINTS[sourceBucket],
      ideas: list,
    });
  }
  return groups;
}

/** Nur Filter anzeigen, für die es Ideen gibt (+ immer Alle). */
export function availableSocialAutopilotIdeaFilters(
  ideas: SocialAutopilotIdea[],
): SocialAutopilotIdeaFilter[] {
  const present = new Set(ideas.map((i) => i.sourceBucket));
  return SOCIAL_AUTOPILOT_IDEA_FILTERS.filter(
    (f) => f === "all" || present.has(f),
  );
}
