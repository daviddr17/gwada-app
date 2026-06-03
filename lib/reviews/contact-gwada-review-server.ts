import "server-only";

import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import type { SupabaseClient } from "@supabase/supabase-js";

function extractReviewTokensFromBodies(
  bodies: readonly string[],
): string[] {
  const tokens = new Set<string>();
  for (const body of bodies) {
    const match = body.match(/\/bewertung\/([A-Za-z0-9_-]+)/);
    if (match?.[1]) tokens.add(match[1]);
  }
  return [...tokens];
}

async function findContactIdByEmail(
  admin: SupabaseClient,
  restaurantId: string,
  emailNormalized: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact_emails")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("email_normalized", emailNormalized)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string | undefined) ?? null;
}

async function findContactIdByPhone(
  admin: SupabaseClient,
  restaurantId: string,
  phoneNormalized: string,
): Promise<string | null> {
  const { data } = await admin
    .from("contact_phones")
    .select("contact_id")
    .eq("restaurant_id", restaurantId)
    .eq("phone_normalized", phoneNormalized)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string | undefined) ?? null;
}

export async function resolveContactIdByGuestIdentity(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    guestPhone?: string | null;
    guestEmail?: string | null;
  },
): Promise<string | null> {
  const phoneNorm = params.guestPhone
    ? normalizeContactPhone(params.guestPhone)
    : null;
  const emailNorm = params.guestEmail
    ? normalizeContactEmail(params.guestEmail)
    : null;

  if (phoneNorm) {
    const byPhone = await findContactIdByPhone(
      admin,
      params.restaurantId,
      phoneNorm,
    );
    if (byPhone) return byPhone;
  }
  if (emailNorm) {
    return findContactIdByEmail(admin, params.restaurantId, emailNorm);
  }
  return null;
}

/** Kontakt hat bereits mindestens eine Gwada-Bewertung abgegeben. */
export async function contactHasSubmittedGwadaReview(
  admin: SupabaseClient,
  restaurantId: string,
  contactId: string,
): Promise<boolean> {
  const { data: reservations } = await admin
    .from("reservations")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .limit(200);

  const reservationIds = (reservations ?? []).map((r) => r.id as string);
  if (reservationIds.length > 0) {
    const { count } = await admin
      .from("gwada_reviews")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .in("reservation_id", reservationIds);
    if ((count ?? 0) > 0) return true;
  }

  const { data: outbound } = await admin
    .from("contact_messages")
    .select("body")
    .eq("restaurant_id", restaurantId)
    .eq("contact_id", contactId)
    .eq("direction", "outbound")
    .ilike("body", "%/bewertung/%")
    .limit(100);

  const tokens = extractReviewTokensFromBodies(
    (outbound ?? []).map((m) => (m.body as string) ?? ""),
  );
  if (tokens.length === 0) return false;

  const { data: invitations } = await admin
    .from("gwada_review_invitations")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .in("token", tokens);

  const invitationIds = (invitations ?? []).map((i) => i.id as string);
  if (invitationIds.length === 0) return false;

  const { count: reviewCount } = await admin
    .from("gwada_reviews")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", restaurantId)
    .in("invitation_id", invitationIds);

  return (reviewCount ?? 0) > 0;
}

/** Gast der Reservierung (Kontakt oder Telefon/E-Mail) hat bereits bewertet. */
export async function reservationGuestAlreadyReviewed(
  admin: SupabaseClient,
  params: { restaurantId: string; reservationId: string },
): Promise<boolean> {
  const { data: reservation } = await admin
    .from("reservations")
    .select("contact_id, guest_phone, guest_email")
    .eq("id", params.reservationId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (!reservation) return false;

  let contactId = (reservation.contact_id as string | null) ?? null;
  if (!contactId) {
    contactId = await resolveContactIdByGuestIdentity(admin, {
      restaurantId: params.restaurantId,
      guestPhone: reservation.guest_phone as string | null,
      guestEmail: reservation.guest_email as string | null,
    });
  }
  if (!contactId) return false;

  return contactHasSubmittedGwadaReview(
    admin,
    params.restaurantId,
    contactId,
  );
}

async function contactIdsByInvitationTokens(
  admin: SupabaseClient,
  restaurantId: string,
  tokens: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data: messages } = await admin
    .from("contact_messages")
    .select("contact_id, body, created_at")
    .eq("restaurant_id", restaurantId)
    .eq("direction", "outbound")
    .ilike("body", "%/bewertung/%")
    .not("contact_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  for (const m of messages ?? []) {
    const body = (m.body as string) ?? "";
    const contactId = m.contact_id as string;
    for (const token of unique) {
      if (!map.has(token) && body.includes(`/bewertung/${token}`)) {
        map.set(token, contactId);
      }
    }
  }
  return map;
}

export async function resolveContactIdForGwadaReview(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string | null;
    invitationToken: string | null;
  },
): Promise<string | null> {
  if (params.reservationId) {
    const { data: res } = await admin
      .from("reservations")
      .select("contact_id, guest_phone, guest_email")
      .eq("id", params.reservationId)
      .eq("restaurant_id", params.restaurantId)
      .maybeSingle();

    if (res?.contact_id) {
      return res.contact_id as string;
    }
    const byGuest = await resolveContactIdByGuestIdentity(admin, {
      restaurantId: params.restaurantId,
      guestPhone: res?.guest_phone as string | null,
      guestEmail: res?.guest_email as string | null,
    });
    if (byGuest) return byGuest;
  }

  if (params.invitationToken) {
    const byToken = await contactIdsByInvitationTokens(
      admin,
      params.restaurantId,
      [params.invitationToken],
    );
    return byToken.get(params.invitationToken) ?? null;
  }

  return null;
}

export type GwadaReviewRowForContact = {
  id: string;
  reservation_id: string | null;
  invitation_id: string;
};

export async function enrichGwadaReviewsWithContactIds(
  admin: SupabaseClient,
  restaurantId: string,
  rows: GwadaReviewRowForContact[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (rows.length === 0) return map;

  const reservationIds = [
    ...new Set(
      rows
        .map((r) => r.reservation_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const reservationContactById = new Map<string, string>();
  const guestIdentityByReservation = new Map<
    string,
    { phone: string | null; email: string | null }
  >();

  if (reservationIds.length > 0) {
    const { data: reservations } = await admin
      .from("reservations")
      .select("id, contact_id, guest_phone, guest_email")
      .eq("restaurant_id", restaurantId)
      .in("id", reservationIds);

    for (const res of reservations ?? []) {
      const id = res.id as string;
      if (res.contact_id) {
        reservationContactById.set(id, res.contact_id as string);
      } else {
        guestIdentityByReservation.set(id, {
          phone: (res.guest_phone as string | null) ?? null,
          email: (res.guest_email as string | null) ?? null,
        });
      }
    }
  }

  const invitationIds = [...new Set(rows.map((r) => r.invitation_id))];
  const tokenByInvitationId = new Map<string, string>();
  if (invitationIds.length > 0) {
    const { data: invitations } = await admin
      .from("gwada_review_invitations")
      .select("id, token")
      .eq("restaurant_id", restaurantId)
      .in("id", invitationIds);

    for (const inv of invitations ?? []) {
      tokenByInvitationId.set(inv.id as string, inv.token as string);
    }
  }

  const tokensNeeded: string[] = [];
  for (const row of rows) {
    if (map.has(row.id)) continue;
    if (row.reservation_id) {
      const direct = reservationContactById.get(row.reservation_id);
      if (direct) {
        map.set(row.id, direct);
        continue;
      }
      const guest = guestIdentityByReservation.get(row.reservation_id);
      if (guest) {
        const byGuest = await resolveContactIdByGuestIdentity(admin, {
          restaurantId,
          guestPhone: guest.phone,
          guestEmail: guest.email,
        });
        if (byGuest) {
          map.set(row.id, byGuest);
          continue;
        }
      }
    }
    const token = tokenByInvitationId.get(row.invitation_id);
    if (token) tokensNeeded.push(token);
  }

  const contactByToken = await contactIdsByInvitationTokens(
    admin,
    restaurantId,
    tokensNeeded,
  );

  for (const row of rows) {
    if (map.has(row.id)) continue;
    const token = tokenByInvitationId.get(row.invitation_id);
    if (!token) continue;
    const contactId = contactByToken.get(token);
    if (contactId) map.set(row.id, contactId);
  }

  return map;
}
