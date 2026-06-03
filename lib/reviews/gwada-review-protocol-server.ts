import "server-only";

import { reviewInvitationPublicUrl } from "@/lib/reviews/gwada-review-invitation-server";
import type {
  GwadaReviewProtocolEvent,
  GwadaReviewProtocolPayload,
  GwadaReviewsOverviewProtocolPayload,
} from "@/lib/reviews/gwada-review-protocol-types";
import { getPublicSiteUrl } from "@/lib/public-env";
import type { SupabaseClient } from "@supabase/supabase-js";

async function profileNamesByIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const { data } = await admin
    .from("profiles")
    .select("id, given_name, family_name")
    .in("id", ids);

  const map = new Map<string, string>();
  for (const p of data ?? []) {
    const label = [p.given_name, p.family_name]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean)
      .join(" ");
    if (label) map.set(p.id as string, label);
  }
  return map;
}

function channelLabel(ch: string): string {
  if (ch === "whatsapp") return "WhatsApp";
  if (ch === "email") return "E-Mail";
  if (ch === "gwada") return "Gwada";
  return ch;
}

function messagesHref(contactId: string, platform: string): string {
  const params = new URLSearchParams({
    contact: contactId,
    platform: platform === "whatsapp" || platform === "email" ? platform : "gwada",
  });
  return `/kontakte/nachrichten?${params.toString()}`;
}

function extractReviewTokenFromBody(body: string): string | null {
  const match = body.match(/\/bewertung\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function isExternalOutboundMessage(row: {
  direction: string;
  platform: string;
}): boolean {
  return row.direction === "outbound" && row.platform !== "gwada";
}

const OVERVIEW_EVENT_LIMIT = 250;
const OVERVIEW_INVITATION_LIMIT = 200;
const OVERVIEW_REVIEW_LIMIT = 200;
const OVERVIEW_MESSAGE_LIMIT = 400;

export async function loadGwadaReviewProtocol(
  admin: SupabaseClient,
  params: { restaurantId: string; reviewId: string },
): Promise<
  | { data: GwadaReviewProtocolPayload; error: null }
  | { data: null; error: string }
> {
  const { data: review, error: reviewErr } = await admin
    .from("gwada_reviews")
    .select(
      `
      id,
      rating,
      guest_display_name,
      created_at,
      reservation_id,
      invitation_id,
      gwada_review_invitations (
        id,
        token,
        reservation_id,
        created_at,
        completed_at,
        expires_at,
        created_by,
        link_sent_at,
        link_sent_by,
        link_sent_channels
      )
    `,
    )
    .eq("id", params.reviewId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (reviewErr || !review) {
    return { data: null, error: "not_found" };
  }

  const invRaw = review.gwada_review_invitations;
  const invitation = (Array.isArray(invRaw) ? invRaw[0] : invRaw) as
    | Record<string, unknown>
    | undefined;
  if (!invitation?.token) {
    return { data: null, error: "invitation_missing" };
  }

  const token = invitation.token as string;
  const invitationId = invitation.id as string;
  const reservationId =
    (review.reservation_id as string | null) ??
    (invitation.reservation_id as string | null);

  const origin = getPublicSiteUrl()?.replace(/\/$/, "") ?? "";
  const reviewUrl = origin ? reviewInvitationPublicUrl(origin, token) : null;

  const actorIds = [
    invitation.created_by as string | null,
    invitation.link_sent_by as string | null,
  ];
  const events: GwadaReviewProtocolEvent[] = [];

  if (reservationId) {
    const { data: res } = await admin
      .from("reservations")
      .select(
        "id, reservation_number, starts_at, guest_first_name, guest_last_name, contact_id",
      )
      .eq("id", reservationId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();

    if (res?.id) {
      const guest = `${res.guest_first_name ?? ""} ${res.guest_last_name ?? ""}`.trim();
      const when = res.starts_at as string;
      events.push({
        id: `reservation-${res.id}`,
        at: when,
        kind: "reservation",
        title: "Reservierung",
        description: guest
          ? `#${res.reservation_number} · ${guest}`
          : `Reservierung #${res.reservation_number}`,
        href: `/reservierungen/uebersicht?reservation=${encodeURIComponent(res.id as string)}`,
        hrefLabel: "Reservierung öffnen",
      });
    }
  }

  const isManual = !reservationId;
  events.push({
    id: `invitation-${invitationId}`,
    at: invitation.created_at as string,
    kind: "invitation_created",
    title: isManual ? "Bewertungslink erstellt" : "Einladungslink erzeugt",
    description: isManual
      ? "Manuell unter Bewertungen"
      : "Automatisch für Bewertungsnachfrage (z. B. Danke-Nachricht)",
    actorName: null,
  });

  const { data: messages } = await admin
    .from("contact_messages")
    .select("id, platform, direction, created_at, sent_by, contact_id, reservation_id")
    .eq("restaurant_id", params.restaurantId)
    .ilike("body", `%/bewertung/${token}%`)
    .order("created_at", { ascending: true });

  const messageSentBy = new Map<string, string | null>();
  for (const m of messages ?? []) {
    const row = m as Record<string, unknown>;
    const platform = row.platform as string;
    if (!isExternalOutboundMessage({
      direction: row.direction as string,
      platform,
    })) {
      continue;
    }
    const sentBy = (row.sent_by as string | null) ?? null;
    actorIds.push(sentBy);
    const eventId = `message-${row.id as string}`;
    messageSentBy.set(eventId, sentBy);
    events.push({
      id: eventId,
      at: row.created_at as string,
      kind: "message_sent",
      title: `Link versendet (${channelLabel(platform)})`,
      description: reviewUrl ? "Enthält den Bewertungslink" : undefined,
      actorName: null,
      href:
        typeof row.contact_id === "string"
          ? messagesHref(row.contact_id, platform)
          : null,
      hrefLabel: "Nachricht öffnen",
    });
  }

  const linkSentAt = invitation.link_sent_at as string | null;
  const linkChannels = invitation.link_sent_channels as string[] | null;
  if (
    linkSentAt &&
    !(messages ?? []).some((m) =>
      isExternalOutboundMessage(m as { direction: string; platform: string }),
    )
  ) {
    actorIds.push(invitation.link_sent_by as string | null);
    const chLabels = (linkChannels ?? [])
      .filter((c) => c !== "gwada")
      .map(channelLabel);
    events.push({
      id: `link-sent-${invitationId}`,
      at: linkSentAt,
      kind: "link_sent",
      title: "Link versendet",
      description:
        chLabels.length > 0 ? `Über ${chLabels.join(" und ")}` : undefined,
      actorName: null,
    });
  }

  events.push({
    id: `review-${review.id}`,
    at: review.created_at as string,
    kind: "review_submitted",
    title: "Bewertung abgegeben",
    description: `${review.rating} von 5 Sternen`,
    actorName: (review.guest_display_name as string | null) ?? null,
  });

  const names = await profileNamesByIds(
    admin,
    actorIds.filter((id): id is string => Boolean(id)),
  );

  for (const e of events) {
    if (e.kind === "invitation_created" && invitation.created_by) {
      e.actorName = names.get(invitation.created_by as string) ?? null;
    }
    if (e.kind === "link_sent" && invitation.link_sent_by) {
      e.actorName = names.get(invitation.link_sent_by as string) ?? null;
    }
    if (e.kind === "message_sent") {
      const sentBy = messageSentBy.get(e.id);
      if (sentBy) e.actorName = names.get(sentBy) ?? null;
    }
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    data: {
      reviewId: review.id as string,
      guestLabel: (review.guest_display_name as string | null) ?? null,
      events,
    },
    error: null,
  };
}

export async function loadGwadaReviewsOverviewProtocol(
  admin: SupabaseClient,
  params: { restaurantId: string },
): Promise<GwadaReviewsOverviewProtocolPayload> {
  const [{ data: invitations }, { data: reviews }, { data: messages }] =
    await Promise.all([
      admin
        .from("gwada_review_invitations")
        .select(
          "id, token, reservation_id, created_at, created_by, link_sent_at, link_sent_by, link_sent_channels, completed_at",
        )
        .eq("restaurant_id", params.restaurantId)
        .order("created_at", { ascending: false })
        .limit(OVERVIEW_INVITATION_LIMIT),
      admin
        .from("gwada_reviews")
        .select(
          "id, rating, guest_display_name, created_at, reservation_id, invitation_id",
        )
        .eq("restaurant_id", params.restaurantId)
        .order("created_at", { ascending: false })
        .limit(OVERVIEW_REVIEW_LIMIT),
      admin
        .from("contact_messages")
        .select(
          "id, platform, direction, created_at, sent_by, contact_id, body",
        )
        .eq("restaurant_id", params.restaurantId)
        .eq("direction", "outbound")
        .neq("platform", "gwada")
        .ilike("body", "%/bewertung/%")
        .order("created_at", { ascending: false })
        .limit(OVERVIEW_MESSAGE_LIMIT),
    ]);

  const invList = invitations ?? [];
  const tokenToInvitation = new Map<
    string,
    (typeof invList)[number] & { token: string }
  >();
  for (const inv of invList) {
    const token = inv.token as string;
    if (token) tokenToInvitation.set(token, inv as (typeof invList)[number] & { token: string });
  }

  const reservationIds = new Set<string>();
  for (const inv of invList) {
    if (inv.reservation_id) reservationIds.add(inv.reservation_id as string);
  }
  for (const rev of reviews ?? []) {
    if (rev.reservation_id) reservationIds.add(rev.reservation_id as string);
  }

  const reservationById = new Map<
    string,
    {
      id: string;
      reservation_number: number;
      starts_at: string;
      guest_first_name: string | null;
      guest_last_name: string | null;
    }
  >();
  if (reservationIds.size > 0) {
    const { data: reservations } = await admin
      .from("reservations")
      .select(
        "id, reservation_number, starts_at, guest_first_name, guest_last_name",
      )
      .eq("restaurant_id", params.restaurantId)
      .in("id", [...reservationIds]);

    for (const res of reservations ?? []) {
      reservationById.set(res.id as string, {
        id: res.id as string,
        reservation_number: res.reservation_number as number,
        starts_at: res.starts_at as string,
        guest_first_name: res.guest_first_name as string | null,
        guest_last_name: res.guest_last_name as string | null,
      });
    }
  }

  const events: GwadaReviewProtocolEvent[] = [];
  const actorIds: (string | null)[] = [];
  const messageSentBy = new Map<string, string | null>();
  const invitationIdsWithExternalSend = new Set<string>();

  for (const inv of invList) {
    const invitationId = inv.id as string;
    const reservationId = inv.reservation_id as string | null;
    const isManual = !reservationId;

    if (reservationId) {
      const res = reservationById.get(reservationId);
      if (res) {
        const guest = `${res.guest_first_name ?? ""} ${res.guest_last_name ?? ""}`.trim();
        events.push({
          id: `overview-reservation-${res.id}-${invitationId}`,
          at: res.starts_at,
          kind: "reservation",
          title: "Reservierung",
          description: guest
            ? `#${res.reservation_number} · ${guest}`
            : `Reservierung #${res.reservation_number}`,
          href: `/reservierungen/uebersicht?reservation=${encodeURIComponent(res.id)}`,
          hrefLabel: "Reservierung öffnen",
        });
      }
    }

    actorIds.push(inv.created_by as string | null);
    events.push({
      id: `overview-invitation-${invitationId}`,
      at: inv.created_at as string,
      kind: "invitation_created",
      title: isManual ? "Bewertungslink erstellt" : "Einladungslink erzeugt",
      description: isManual
        ? "Manuell unter Bewertungen"
        : "Automatisch für Bewertungsnachfrage (z. B. Danke-Nachricht)",
      actorName: null,
    });
  }

  for (const m of messages ?? []) {
    const row = m as Record<string, unknown>;
    const platform = row.platform as string;
    if (!isExternalOutboundMessage({
      direction: row.direction as string,
      platform,
    })) {
      continue;
    }

    const body = (row.body as string) ?? "";
    const token = extractReviewTokenFromBody(body);
    const invitation = token ? tokenToInvitation.get(token) : undefined;
    if (invitation?.id) {
      invitationIdsWithExternalSend.add(invitation.id as string);
    }

    const sentBy = (row.sent_by as string | null) ?? null;
    actorIds.push(sentBy);
    const eventId = `overview-message-${row.id as string}`;
    messageSentBy.set(eventId, sentBy);

    events.push({
      id: eventId,
      at: row.created_at as string,
      kind: "message_sent",
      title: `Link versendet (${channelLabel(platform)})`,
      description: "Enthält den Bewertungslink",
      actorName: null,
      href:
        typeof row.contact_id === "string"
          ? messagesHref(row.contact_id, platform)
          : null,
      hrefLabel: "Nachricht öffnen",
    });
  }

  for (const inv of invList) {
    const invitationId = inv.id as string;
    const linkSentAt = inv.link_sent_at as string | null;
    if (!linkSentAt || invitationIdsWithExternalSend.has(invitationId)) continue;

    actorIds.push(inv.link_sent_by as string | null);
    const chLabels = ((inv.link_sent_channels as string[] | null) ?? [])
      .filter((c) => c !== "gwada")
      .map(channelLabel);

    events.push({
      id: `overview-link-sent-${invitationId}`,
      at: linkSentAt,
      kind: "link_sent",
      title: "Link versendet",
      description:
        chLabels.length > 0 ? `Über ${chLabels.join(" und ")}` : undefined,
      actorName: null,
    });
  }

  for (const rev of reviews ?? []) {
    const guest = (rev.guest_display_name as string | null) ?? null;
    events.push({
      id: `overview-review-${rev.id}`,
      at: rev.created_at as string,
      kind: "review_submitted",
      title: "Bewertung abgegeben",
      description: [
        `${rev.rating} von 5 Sternen`,
        guest,
      ]
        .filter(Boolean)
        .join(" · "),
      actorName: guest,
      href: `/bewertungen/uebersicht?platform=gwada&reviewProtocol=${encodeURIComponent(rev.id as string)}`,
      hrefLabel: "Einzelprotokoll",
    });
  }

  const names = await profileNamesByIds(
    admin,
    actorIds.filter((id): id is string => Boolean(id)),
  );

  for (const e of events) {
    if (e.kind === "invitation_created") {
      const invId = e.id.replace("overview-invitation-", "");
      const inv = invList.find((i) => (i.id as string) === invId);
      if (inv?.created_by) {
        e.actorName = names.get(inv.created_by as string) ?? null;
      }
    }
    if (e.kind === "link_sent") {
      const invId = e.id.replace("overview-link-sent-", "");
      const inv = invList.find((i) => (i.id as string) === invId);
      if (inv?.link_sent_by) {
        e.actorName = names.get(inv.link_sent_by as string) ?? null;
      }
    }
    if (e.kind === "message_sent") {
      const sentBy = messageSentBy.get(e.id);
      if (sentBy) e.actorName = names.get(sentBy) ?? null;
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return { events: events.slice(0, OVERVIEW_EVENT_LIMIT) };
}
