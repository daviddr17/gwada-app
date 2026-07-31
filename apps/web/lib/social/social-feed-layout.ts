import type { SocialSlotKind, SocialTemplateId } from "@/lib/social/social-brand-kit";
import {
  SOCIAL_FEED_LAYOUT_IDS,
  type SocialFeedLayoutId,
} from "@/lib/social/social-feed-brand-system";

/** Slot → bevorzugtes Premium-Layout (wenn in preferredLayouts enthalten). */
const SLOT_PREFERRED_LAYOUT: Record<SocialSlotKind, SocialFeedLayoutId> = {
  menu_dish: "editorial_hero",
  ambient: "atelier_split",
  event: "soiree_event",
  brand: "signature_brand",
  holiday: "signature_brand",
};

const LEGACY_TEMPLATE_TO_LAYOUT: Record<SocialTemplateId, SocialFeedLayoutId> = {
  food_hero: "editorial_hero",
  brand_card: "signature_brand",
  quote: "signature_brand",
};

export function feedLayoutToLegacyTemplate(
  layout: SocialFeedLayoutId,
): SocialTemplateId {
  switch (layout) {
    case "editorial_hero":
    case "atelier_split":
      return "food_hero";
    case "soiree_event":
    case "signature_brand":
      return "brand_card";
  }
}

export function parseFeedLayoutId(raw: unknown): SocialFeedLayoutId | null {
  if (typeof raw !== "string") return null;
  return SOCIAL_FEED_LAYOUT_IDS.includes(raw as SocialFeedLayoutId)
    ? (raw as SocialFeedLayoutId)
    : null;
}

/**
 * Wählt ein Layout für Slot + Restaurant-Auswahl.
 * Bevorzugt Slot-Affinität, fällt auf erste preferredLayout zurück.
 */
export function pickFeedLayoutForSlot(params: {
  slotKind: SocialSlotKind;
  preferredLayouts: SocialFeedLayoutId[];
  legacyTemplateId?: SocialTemplateId;
}): SocialFeedLayoutId {
  const preferred =
    params.preferredLayouts.length > 0
      ? params.preferredLayouts
      : ([...SOCIAL_FEED_LAYOUT_IDS] as SocialFeedLayoutId[]);

  const slotWant = SLOT_PREFERRED_LAYOUT[params.slotKind];
  if (preferred.includes(slotWant)) return slotWant;

  // Holiday mit Foto → editorial wenn gewählt
  if (
    params.slotKind === "holiday" &&
    preferred.includes("editorial_hero")
  ) {
    return "editorial_hero";
  }

  if (params.legacyTemplateId) {
    const fromLegacy = LEGACY_TEMPLATE_TO_LAYOUT[params.legacyTemplateId];
    if (preferred.includes(fromLegacy)) return fromLegacy;
  }

  return preferred[0] ?? "editorial_hero";
}

export function resolveSuggestionFeedLayout(params: {
  slotKind: SocialSlotKind;
  templateId: SocialTemplateId;
  source: Record<string, unknown>;
  preferredLayouts?: SocialFeedLayoutId[];
}): SocialFeedLayoutId {
  const preferred =
    params.preferredLayouts && params.preferredLayouts.length > 0
      ? params.preferredLayouts
      : [...SOCIAL_FEED_LAYOUT_IDS];
  const stored = parseFeedLayoutId(params.source.feedLayout);
  // Gespeichertes Layout nur behalten, wenn es noch in der Social-Marke aktiv ist.
  if (stored && preferred.includes(stored)) return stored;
  return pickFeedLayoutForSlot({
    slotKind: params.slotKind,
    preferredLayouts: preferred,
    legacyTemplateId: params.templateId,
  });
}
