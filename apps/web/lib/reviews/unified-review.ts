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
  /** Verknüpfte Reservierung (Gwada), falls vorhanden */
  reservationId?: string | null;
  reservationNumber?: number | null;
  /** Auf Profil/Embed ausgeblendet — nur Dashboard. */
  hiddenFromPublic?: boolean;
  /** Pro Nutzer — fehlt in API = ungelesen. */
  isUnread?: boolean;
};
