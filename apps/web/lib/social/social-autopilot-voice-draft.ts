import type { SocialTone } from "@/lib/social/social-brand-kit";

/** Vorschlag aus „Aus Social lernen“ — erst nach Übernehmen ins Formular. */
export type SocialAutopilotVoiceDraft = {
  voiceNotes: string;
  goldCaptions: string[];
  tone: SocialTone | null;
  sampleCount: number;
  sourcePlatforms: string[];
  fromLlm: boolean;
};
