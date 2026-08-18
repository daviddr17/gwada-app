import "server-only";

import {
  createEventInquiryQuotation,
  formatEventPackageNotes,
} from "@/lib/events/create-event-inquiry-quotation";
import { isEventPackageId } from "@/lib/events/event-package";
import { loadActiveEventPackagesByIds } from "@/lib/events/event-packages-server";
import { RESERVATION_KIND_PRIVATE_EVENT } from "@/lib/reservations/reservation-kind";
import {
  normalizeReservationGuestCompany,
  normalizeReservationGuestFirstName,
  normalizeReservationGuestLastName,
} from "@/lib/reservations/reservation-guest-name";
import { isValidStaffPartySize } from "@/lib/reservations/reservation-party-size";
import {
  buildReservationLogChanges,
  buildReservationLogDetails,
  reservationSnapshotFromPayload,
} from "@/lib/reservations/reservation-log-build";
import { insertReservationLogEntry } from "@/lib/reservations/reservation-log-insert";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import {
  fetchPublicEmbedRestaurant,
} from "@/lib/reservations/public-reservation-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatReservationGuestLabel } from "@/lib/types/reservation-log";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_EVENT_DWELL_MINUTES = 240;

export type PublicEventInquiryCreateBody = {
  slug: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_company?: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at?: string | null;
  occasion?: string | null;
  message?: string | null;
  package_ids?: string[] | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  website?: string;
};

function honeypotFilled(website: string | undefined): boolean {
  return Boolean(website?.trim());
}

function hasGuestContact(phone: string | null, email: string | null): boolean {
  return Boolean(phone?.trim()) || Boolean(email?.trim());
}

function hasNotifyChannel(notifyEmail: boolean, notifyWhatsapp: boolean): boolean {
  return notifyEmail || notifyWhatsapp;
}

function validateIsoStart(startsAt: string): boolean {
  return Number.isFinite(new Date(startsAt).getTime());
}

const MAX_INQUIRY_PACKAGE_IDS = 12;

function parseRequestedPackageIds(raw: string[] | null | undefined): string[] | null {
  if (!raw || raw.length === 0) return [];
  if (raw.length > MAX_INQUIRY_PACKAGE_IDS) return null;
  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || !isEventPackageId(value)) return null;
    if (!ids.includes(value)) ids.push(value);
  }
  return ids;
}

function formatInquiryNotes(
  occasion: string,
  message: string,
  packageNotes: string | null,
): string | null {
  const parts: string[] = [];
  if (occasion) parts.push(`Anlass: ${occasion}`);
  if (packageNotes) parts.push(packageNotes);
  if (message) parts.push(message);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

async function pendingStatusId(admin: SupabaseClient): Promise<string | null> {
  const { data } = await admin
    .from("reservation_statuses")
    .select("id")
    .eq("code", "pending")
    .maybeSingle();
  return data?.id ?? null;
}

export async function createPublicEventInquiry(
  body: PublicEventInquiryCreateBody,
): Promise<
  | { data: { ok: true }; error: null }
  | { data: null; error: string; status: number }
> {
  if (honeypotFilled(body.website)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!body.terms_accepted) {
    return { data: null, error: "terms_required", status: 400 };
  }
  if (!isValidStaffPartySize(body.party_size) || !validateIsoStart(body.starts_at)) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  if (!normalizeReservationGuestLastName(body.guest_last_name)) {
    return { data: null, error: "last_name_required", status: 400 };
  }
  if (!hasGuestContact(body.guest_phone, body.guest_email)) {
    return { data: null, error: "contact_required", status: 400 };
  }
  if (!hasNotifyChannel(body.notify_email, body.notify_whatsapp)) {
    return { data: null, error: "notify_channel_required", status: 400 };
  }

  const restaurantRes = await fetchPublicEmbedRestaurant(body.slug);
  if (restaurantRes.error || !restaurantRes.data) {
    return {
      data: null,
      error: restaurantRes.error ?? "not_found",
      status: restaurantRes.status ?? 404,
    };
  }
  const restaurant = restaurantRes.data;

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const statusId = await pendingStatusId(admin);
  if (!statusId) {
    return { data: null, error: "server_misconfigured", status: 503 };
  }

  const startsMs = new Date(body.starts_at).getTime();
  const endsMs = body.ends_at
    ? new Date(body.ends_at).getTime()
    : startsMs + DEFAULT_EVENT_DWELL_MINUTES * 60_000;
  if (!Number.isFinite(endsMs) || endsMs <= startsMs) {
    return { data: null, error: "invalid_request", status: 400 };
  }
  const startsAt = new Date(startsMs).toISOString();
  const endsAt = new Date(endsMs).toISOString();
  const dwell = Math.round((endsMs - startsMs) / 60_000);
  const guestCompany = normalizeReservationGuestCompany(body.guest_company);
  const occasion = (body.occasion ?? "").trim();
  const message = (body.message ?? "").trim();
  const guestFirst = normalizeReservationGuestFirstName(body.guest_first_name);
  const guestLast = normalizeReservationGuestLastName(body.guest_last_name);
  const packageIds = parseRequestedPackageIds(body.package_ids);
  if (packageIds == null) {
    return { data: null, error: "invalid_packages", status: 400 };
  }
  const selectedPackages = await loadActiveEventPackagesByIds(
    admin,
    restaurant.id,
    packageIds,
  );
  if (selectedPackages == null) {
    return { data: null, error: "invalid_packages", status: 400 };
  }
  const notes = formatInquiryNotes(
    occasion,
    message,
    formatEventPackageNotes(selectedPackages),
  );

  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurant.id,
      kind: RESERVATION_KIND_PRIVATE_EVENT,
      guest_first_name: guestFirst,
      guest_last_name: guestLast,
      guest_company: guestCompany,
      guest_phone: body.guest_phone?.trim() || null,
      guest_email: body.guest_email?.trim() || null,
      party_size: body.party_size,
      starts_at: startsAt,
      ends_at: endsAt,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: body.notify_email,
      notify_whatsapp: body.notify_whatsapp,
      terms_accepted: body.terms_accepted,
      notes,
    })
    .select("id, reservation_number")
    .single();

  if (error || !data?.id) {
    console.warn("[gwada] public event inquiry insert", error?.message);
    return { data: null, error: "create_failed", status: 500 };
  }

  const quotationId = await createEventInquiryQuotation({
    sb: admin,
    restaurantId: restaurant.id,
    timezone: restaurant.timezone,
    startsAtIso: startsAt,
    partySize: body.party_size,
    packages: selectedPackages,
    guestFirstName: guestFirst,
    guestLastName: guestLast,
    guestCompany,
    guestEmail: body.guest_email?.trim() || null,
    guestPhone: body.guest_phone?.trim() || null,
    occasion,
    message,
  });
  if (quotationId) {
    const { error: quoteLinkError } = await admin
      .from("reservations")
      .update({ quotation_id: quotationId })
      .eq("id", data.id)
      .eq("restaurant_id", restaurant.id);
    if (quoteLinkError) {
      console.warn("[gwada] event inquiry quotation link", quoteLinkError.message);
    }
  }

  const after = reservationSnapshotFromPayload(
    {
      guest_first_name: guestFirst,
      guest_last_name: guestLast,
      guest_company: guestCompany,
      guest_phone: body.guest_phone?.trim() || null,
      guest_email: body.guest_email?.trim() || null,
      party_size: body.party_size,
      starts_at: startsAt,
      ends_at: endsAt,
      status_id: statusId,
      dining_table_id: null,
      dwell_minutes: dwell,
      notify_email: body.notify_email,
      notify_whatsapp: body.notify_whatsapp,
      terms_accepted: body.terms_accepted,
      notes,
    },
    "Ausstehend",
    "—",
  );

  await insertReservationLogEntry(admin, {
    restaurantId: restaurant.id,
    reservationId: data.id,
    action: "created",
    reservationNumber: data.reservation_number,
    guestLabel: formatReservationGuestLabel(
      data.reservation_number,
      guestFirst,
      guestLast,
      guestCompany,
    ),
    details: buildReservationLogDetails(
      buildReservationLogChanges(null, after, restaurant.timezone),
      { actorSource: "guest", summary: "Veranstaltungsanfrage" },
    ),
  });

  void dispatchReservationWhatsapp(admin, data.id, "created").catch((e) => {
    console.warn("[gwada] event inquiry whatsapp dispatch", e);
  });
  void dispatchReservationEmail(admin, data.id, "created").catch((e) => {
    console.warn("[gwada] event inquiry email dispatch", e);
  });

  return { data: { ok: true }, error: null };
}
