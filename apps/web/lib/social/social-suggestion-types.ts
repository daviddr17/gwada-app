import type {
  SocialSlotKind,
  SocialTemplateId,
} from "@/lib/social/social-brand-kit";

export const SOCIAL_SUGGESTION_STATUSES = [
  "pending",
  "approved",
  "skipped",
  "expired",
  "needs_asset",
] as const;
export type SocialSuggestionStatus =
  (typeof SOCIAL_SUGGESTION_STATUSES)[number];

export type SocialSuggestionAsset = {
  imageUrl: string | null;
  imageLabel?: string;
  source?: "gallery" | "menu" | "profile" | "event" | "none";
  sourceId?: string;
  storageBucket?: string;
  storagePath?: string;
};

export type SocialPostSuggestion = {
  id: string;
  restaurantId: string;
  status: SocialSuggestionStatus;
  slotKind: SocialSlotKind;
  templateId: SocialTemplateId;
  plannedAt: string;
  title: string | null;
  caption: string;
  platforms: string[];
  source: Record<string, unknown>;
  asset: SocialSuggestionAsset;
  newsPostId: string | null;
  createdAt: string;
};

export type SocialMediaTask = {
  id: string;
  restaurantId: string;
  kind: "upload_photos" | "mark_heroes";
  status: "open" | "done" | "dismissed";
  title: string;
  body: string;
  createdAt: string;
};

export const SOCIAL_SLOT_KIND_LABELS: Record<SocialSlotKind, string> = {
  holiday: "Feiertag",
  menu_dish: "Gericht",
  event: "Event",
  brand: "Marke",
  ambient: "Ambiente",
};

export const SOCIAL_TEMPLATE_LABELS: Record<SocialTemplateId, string> = {
  food_hero: "Food Hero",
  brand_card: "Brand Card",
  quote: "Zitat",
};
