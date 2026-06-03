export type GwadaReviewProtocolEventKind =
  | "reservation"
  | "invitation_created"
  | "link_sent"
  | "message_sent"
  | "review_submitted";

export type GwadaReviewProtocolEvent = {
  id: string;
  at: string;
  kind: GwadaReviewProtocolEventKind;
  title: string;
  description?: string;
  actorName?: string | null;
  href?: string | null;
  hrefLabel?: string | null;
};

export type GwadaReviewProtocolPayload = {
  reviewId: string;
  guestLabel: string | null;
  events: GwadaReviewProtocolEvent[];
};

export type GwadaReviewsOverviewProtocolPayload = {
  events: GwadaReviewProtocolEvent[];
};
