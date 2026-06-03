import type { ReviewPlatform } from "@/lib/constants/review-platforms";

export type UnifiedReview = {
  id: string;
  platform: ReviewPlatform;
  rating: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
  reply: string | null;
  canReply: boolean;
  externalUrl: string | null;
  /** Verknüpfter Kontakt (Gwada), falls ermittelbar */
  contactId?: string | null;
};
