export const PLATFORM_NEWSLETTER_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "cancelled",
] as const;

export type PlatformNewsletterStatus =
  (typeof PLATFORM_NEWSLETTER_STATUSES)[number];

export const PLATFORM_NEWSLETTER_STATUS_LABELS_DE: Record<
  PlatformNewsletterStatus,
  string
> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  sending: "Wird gesendet",
  sent: "Gesendet",
  cancelled: "Abgebrochen",
};

export type PlatformNewsletterBlock = {
  id: string;
  newsletterId: string;
  sortOrder: number;
  heading: string;
  body: string;
  imagePath: string | null;
  imageAlt: string | null;
  imageUrl: string | null;
};

export type PlatformNewsletter = {
  id: string;
  title: string;
  subject: string;
  preheader: string | null;
  status: PlatformNewsletterStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  sentAt: string | null;
  isTemplate: boolean;
  sourceNewsletterId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  outboxPending: number;
  outboxSent: number;
  outboxFailed: number;
};

export type PlatformNewsletterDetail = PlatformNewsletter & {
  blocks: PlatformNewsletterBlock[];
};

export type PlatformNewsletterSubscriber = {
  id: string;
  email: string;
  locale: string;
  optedIn: boolean;
  profileId: string | null;
  optedInAt: string | null;
  optedOutAt: string | null;
};
