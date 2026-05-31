import "server-only";

import { sendContactMessageServer } from "@/lib/contact-messages/send-contact-message-server";
import { dispatchReservationEmail } from "@/lib/reservations/reservation-email-dispatch";
import { reservationStatusDispatchEvent } from "@/lib/reservations/reservation-status-dispatch-event";
import { dispatchReservationWhatsapp } from "@/lib/reservations/reservation-whatsapp-dispatch";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DisplayCreateReservationInput = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
  guest_message?: string | null;
  restaurant_name?: string | null;
};

export async function createDisplayReservation(
  admin: SupabaseClient,
  restaurantId: string,
  input: DisplayCreateReservationInput,
): Promise<
  | { ok: true; id: string; reservation_number: number; guest_pin: string }
  | { ok: false; error: string }
> {
  const { data, error } = await admin
    .from("reservations")
    .insert({
      restaurant_id: restaurantId,
      guest_first_name: input.guest_first_name,
      guest_last_name: input.guest_last_name,
      guest_phone: input.guest_phone,
      guest_email: input.guest_email,
      party_size: input.party_size,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status_id: input.status_id,
      dining_table_id: input.dining_table_id,
      dwell_minutes: input.dwell_minutes,
      notify_email: input.notify_email,
      notify_whatsapp: input.notify_whatsapp,
      terms_accepted: input.terms_accepted,
    })
    .select("id, reservation_number, guest_pin, contact_id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "create_failed" };
  }

  const guestMessage = input.guest_message?.trim();
  const contactId = (data.contact_id as string | null) ?? null;
  if (guestMessage && contactId) {
    await sendContactMessageServer(admin, {
      restaurantId,
      contactId,
      body: guestMessage,
      direction: "inbound",
      channels: ["gwada"],
      reservationId: data.id as string,
      restaurantName: input.restaurant_name ?? null,
    }).catch(() => undefined);
  }

  if (input.notify_whatsapp) {
    void dispatchReservationWhatsapp(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }
  if (input.notify_email) {
    void dispatchReservationEmail(admin, data.id as string, "created").catch(
      () => undefined,
    );
  }

  return {
    ok: true,
    id: data.id as string,
    reservation_number: data.reservation_number as number,
    guest_pin: data.guest_pin as string,
  };
}

export async function updateDisplayReservationStatus(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  statusId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      notify_email,
      notify_whatsapp,
      ${RESERVATION_STATUS_EMBED} ( code )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const previousCode =
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : null;

  const { data: newStatus } = await admin
    .from("reservation_statuses")
    .select("code")
    .eq("id", statusId)
    .maybeSingle();

  const newCode = (newStatus?.code as string | undefined) ?? "";
  const dispatchEvent = reservationStatusDispatchEvent(previousCode, newCode);

  const { error } = await admin
    .from("reservations")
    .update({ status_id: statusId })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (dispatchEvent && reservation.notify_whatsapp) {
    void dispatchReservationWhatsapp(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }
  if (dispatchEvent && reservation.notify_email) {
    void dispatchReservationEmail(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }

  return { ok: true };
}

export type DisplayUpdateReservationInput = {
  guest_first_name: string;
  guest_last_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  party_size: number;
  starts_at: string;
  ends_at: string;
  status_id: string;
  dining_table_id: string | null;
  dwell_minutes: number | null;
  notify_email: boolean;
  notify_whatsapp: boolean;
  terms_accepted: boolean;
};

export async function updateDisplayReservation(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  input: DisplayUpdateReservationInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select(
      `
      id,
      restaurant_id,
      notify_email,
      notify_whatsapp,
      ${RESERVATION_STATUS_EMBED} ( code )
    `,
    )
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const statusRaw = (reservation as Record<string, unknown>).reservation_statuses;
  const statusOne = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
  const previousCode =
    statusOne && typeof statusOne === "object" && "code" in statusOne
      ? String((statusOne as { code: string }).code)
      : null;

  const { data: newStatus } = await admin
    .from("reservation_statuses")
    .select("code")
    .eq("id", input.status_id)
    .maybeSingle();

  const newCode = (newStatus?.code as string | undefined) ?? "";
  if (
    input.dining_table_id &&
    newCode !== "confirmed" &&
    newCode !== "seated"
  ) {
    return { ok: false, error: "table_requires_confirmed" };
  }

  const dispatchEvent = reservationStatusDispatchEvent(previousCode, newCode);

  const { error } = await admin
    .from("reservations")
    .update({
      guest_first_name: input.guest_first_name,
      guest_last_name: input.guest_last_name,
      guest_phone: input.guest_phone,
      guest_email: input.guest_email,
      party_size: input.party_size,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      status_id: input.status_id,
      dining_table_id: input.dining_table_id,
      dwell_minutes: input.dwell_minutes,
      notify_email: input.notify_email,
      notify_whatsapp: input.notify_whatsapp,
      terms_accepted: input.terms_accepted,
    })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const notifyWhatsapp = input.notify_whatsapp;
  const notifyEmail = input.notify_email;

  if (dispatchEvent && notifyWhatsapp) {
    void dispatchReservationWhatsapp(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }
  if (dispatchEvent && notifyEmail) {
    void dispatchReservationEmail(admin, reservationId, dispatchEvent).catch(
      () => undefined,
    );
  }

  return { ok: true };
}

export async function updateDisplayReservationTable(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
  diningTableId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: reservation } = await admin
    .from("reservations")
    .select("id, restaurant_id, status_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation || reservation.restaurant_id !== restaurantId) {
    return { ok: false, error: "not_found" };
  }

  const { data: statusRow } = await admin
    .from("reservation_statuses")
    .select("code")
    .eq("id", reservation.status_id as string)
    .maybeSingle();

  if (
    diningTableId &&
    statusRow?.code !== "confirmed" &&
    statusRow?.code !== "seated"
  ) {
    return { ok: false, error: "table_requires_confirmed" };
  }

  const { error } = await admin
    .from("reservations")
    .update({ dining_table_id: diningTableId })
    .eq("id", reservationId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function applyDisplayAutoTableAssignments(
  admin: SupabaseClient,
  restaurantId: string,
  assignments: Map<string, string | null>,
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  let updated = 0;
  for (const [reservationId, tableId] of assignments) {
    const result = await updateDisplayReservationTable(
      admin,
      restaurantId,
      reservationId,
      tableId,
    );
    if (!result.ok) {
      return result;
    }
    updated += 1;
  }
  return { ok: true, updated };
}
